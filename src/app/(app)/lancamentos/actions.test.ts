import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const sessionUserId = { current: "" };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionUserId.current ? { user: { id: sessionUserId.current } } : null)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { createTransactionAction, updateTransactionAction, deleteTransactionAction } from "./actions";

let userId: string;
let otherUserId: string;
let categoryId: string;
let subcategoryId: string;

async function createUserWithCategory(emailSuffix: string) {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `lancamentos-actions-test-${emailSuffix}@example.com`, passwordHash: "x" },
  });
  const category = await prisma.category.create({ data: { userId: user.id, name: "Grupo" } });
  const subcategory = await prisma.category.create({ data: { userId: user.id, name: "Sub-grupo", parentId: category.id } });
  await prisma.account.create({ data: { userId: user.id, name: "Conta", type: "wallet" } });
  return { user, category, subcategory };
}

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeAll(async () => {
  const main = await createUserWithCategory(`${Date.now()}-main`);
  userId = main.user.id;
  categoryId = main.category.id;
  subcategoryId = main.subcategory.id;

  const other = await createUserWithCategory(`${Date.now()}-other`);
  otherUserId = other.user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
  await prisma.$disconnect();
});

beforeEach(() => {
  sessionUserId.current = userId;
});

function baseFields(overrides: Record<string, string> = {}) {
  return {
    type: "EXPENSE",
    date: "2026-06-10",
    description: "Geladeira",
    amount: "300",
    categoryId,
    subcategoryId,
    recurrence: "NONE",
    tags: JSON.stringify(["casa", "eletro"]),
    ...overrides,
  };
}

describe("createTransactionAction — flag de parcelamento", () => {
  it("gera as N transações do parcelamento, replicando grupo, sub-grupo e hashtags", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ isInstallment: "on", totalInstallments: "4" }))
    );

    expect(result.success).toBe(true);

    const created = await prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: "Geladeira" } },
      orderBy: { installmentNumber: "asc" },
      include: { tags: { include: { tag: true } } },
    });

    expect(created).toHaveLength(4);
    expect(created.map((t) => t.installmentNumber)).toEqual([1, 2, 3, 4]);
    expect(created.every((t) => t.categoryId === categoryId && t.subcategoryId === subcategoryId)).toBe(true);
    expect(created.every((t) => t.tags.map((tt) => tt.tag.name).sort().join(",") === "casa,eletro")).toBe(true);
    expect(created.every((t) => t.installmentPlanId === created[0].installmentPlanId)).toBe(true);
    expect(created.map((t) => t.description)).toEqual([
      "Geladeira (1/4)",
      "Geladeira (2/4)",
      "Geladeira (3/4)",
      "Geladeira (4/4)",
    ]);

    // a parcela N é projetada (N-1) meses a partir da primeira
    expect(created[1].date.getMonth()).toBe((created[0].date.getMonth() + 1) % 12);
    expect(created[3].date.getMonth()).toBe((created[0].date.getMonth() + 3) % 12);
  });

  it("rejeita a flag de parcelamento sem informar a quantidade de parcelas", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ description: "Sem quantidade", isInstallment: "on" }))
    );

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.totalInstallments).toBeTruthy();
  });

  it("rejeita quantidade de parcelas fora do intervalo permitido (2 a 360)", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ description: "Fora do intervalo", isInstallment: "on", totalInstallments: "1" }))
    );

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.totalInstallments).toBeTruthy();
  });

  it("sem a flag, continua criando um único lançamento normal", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ description: "Almoço" }))
    );

    expect(result.success).toBe(true);
    const created = await prisma.transaction.findMany({ where: { userId, description: "Almoço" } });
    expect(created).toHaveLength(1);
    expect(created[0].installmentPlanId).toBeNull();
  });
});

describe("updateTransactionAction — edição em cascata", () => {
  async function createPlan(description: string, totalInstallments: number) {
    await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ description, isInstallment: "on", totalInstallments: String(totalInstallments) }))
    );
    return prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: description } },
      orderBy: { installmentNumber: "asc" },
    });
  }

  it("editar a parcela 1/N propaga valor, categoria e descrição-base para as demais parcelas", async () => {
    const transactions = await createPlan("Notebook", 3);
    const [first, , third] = transactions;

    const otherCategory = await prisma.category.create({ data: { userId, name: "Outro grupo" } });

    const result = await updateTransactionAction(
      { success: false },
      formDataFor(
        baseFields({
          id: first.id,
          description: "Notebook Dell",
          amount: "450",
          categoryId: otherCategory.id,
          subcategoryId: "",
        })
      )
    );

    expect(result.success).toBe(true);

    const updatedThird = await prisma.transaction.findUniqueOrThrow({ where: { id: third.id } });
    expect(updatedThird.amount).toBe(450);
    expect(updatedThird.categoryId).toBe(otherCategory.id);
    expect(updatedThird.description).toBe("Notebook Dell (3/3)");
  });

  it("editar uma parcela que não é a 1/N não propaga para as demais", async () => {
    const transactions = await createPlan("Sofá", 3);
    const [first, second] = transactions;

    const result = await updateTransactionAction(
      { success: false },
      formDataFor(baseFields({ id: second.id, description: "Sofá (2/3)", amount: "999" }))
    );

    expect(result.success).toBe(true);

    const untouchedFirst = await prisma.transaction.findUniqueOrThrow({ where: { id: first.id } });
    expect(untouchedFirst.amount).not.toBe(999);
  });
});

describe("deleteTransactionAction — exclusão em cascata", () => {
  it("excluir qualquer parcela remove todas as transações e o plano", async () => {
    await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ description: "Celular", isInstallment: "on", totalInstallments: "5" }))
    );
    const transactions = await prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: "Celular" } },
    });
    const planId = transactions[0].installmentPlanId!;
    const middleInstallment = transactions.find((t) => t.installmentNumber === 3)!;

    const result = await deleteTransactionAction(middleInstallment.id);
    expect(result.success).toBe(true);

    const remaining = await prisma.transaction.findMany({ where: { userId, installmentPlanId: planId } });
    expect(remaining).toHaveLength(0);

    const plan = await prisma.installmentPlan.findUnique({ where: { id: planId } });
    expect(plan).toBeNull();
  });

  it("não permite excluir um lançamento de outro usuário (IDOR)", async () => {
    sessionUserId.current = otherUserId;
    const created = await createTransactionAction(
      { success: false },
      formDataFor(baseFields({ categoryId: "", subcategoryId: "", description: "Lançamento de outro usuário" }))
    );
    expect(created.success).toBe(true);

    const foreign = await prisma.transaction.findFirstOrThrow({
      where: { userId: otherUserId, description: "Lançamento de outro usuário" },
    });

    sessionUserId.current = userId;
    const result = await deleteTransactionAction(foreign.id);
    expect(result.success).toBe(false);

    const untouched = await prisma.transaction.findUnique({ where: { id: foreign.id } });
    expect(untouched).not.toBeNull();
  });
});
