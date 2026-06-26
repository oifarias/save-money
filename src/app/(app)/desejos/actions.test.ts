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

import {
  createWishBatchAction,
  createWishesBulkAction,
  reorderWishesAction,
  markWishPurchasedAction,
} from "./actions";

let userId: string;
let otherUserId: string;
let categoryId: string;
let subcategoryId: string;
let accountId: string;

async function createUserWithCategory(emailSuffix: string) {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `wish-actions-test-${emailSuffix}@example.com`, passwordHash: "x" },
  });
  const category = await prisma.category.create({ data: { userId: user.id, name: "Grupo" } });
  const subcategory = await prisma.category.create({ data: { userId: user.id, name: "Sub-grupo", parentId: category.id } });
  const account = await prisma.financialAccount.create({ data: { userId: user.id, name: "Conta", type: "wallet" } });
  return { user, category, subcategory, account };
}

beforeAll(async () => {
  const main = await createUserWithCategory(`${Date.now()}-main`);
  userId = main.user.id;
  categoryId = main.category.id;
  subcategoryId = main.subcategory.id;
  accountId = main.account.id;

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

describe("createWishBatchAction", () => {
  it("cria itens com dados de planejamento de compra", async () => {
    const result = await createWishBatchAction({
      categoryId,
      subcategoryId,
      items: [
        {
          name: "Notebook",
          estimatedAmount: 4500,
          purchaseTiming: "THIS_MONTH",
          paymentMethod: "INSTALLMENTS",
          installmentsCount: 10,
          kind: "WANT",
        },
      ],
    });

    expect(result.success).toBe(true);

    const created = await prisma.wish.findFirst({ where: { userId, name: "Notebook" } });
    expect(created?.paymentMethod).toBe("INSTALLMENTS");
    expect(created?.installmentsCount).toBe(10);
    expect(created?.installmentAmount).toBeCloseTo(450);
  });

  it("rejeita categoria de outro usuário (IDOR)", async () => {
    const other = await prisma.category.findFirstOrThrow({ where: { userId: otherUserId, parentId: null } });
    const result = await createWishBatchAction({
      categoryId: other.id,
      subcategoryId: other.id,
      items: [{ name: "Item", estimatedAmount: 100, purchaseTiming: "THIS_MONTH", paymentMethod: "CASH", kind: "WANT" }],
    });

    expect(result.success).toBe(false);
  });
});

describe("createWishesBulkAction", () => {
  it("cria múltiplos itens com valores padrão", async () => {
    const result = await createWishesBulkAction({
      categoryId,
      subcategoryId,
      items: [
        { name: "Fone", estimatedAmount: 150 },
        { name: "Mochila", estimatedAmount: 200 },
      ],
    });

    expect(result.success).toBe(true);
    const items = await prisma.wish.findMany({ where: { userId, name: { in: ["Fone", "Mochila"] } } });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.kind === "WANT" && item.paymentMethod === "CASH")).toBe(true);
  });
});

describe("reorderWishesAction", () => {
  it("reordena a prioridade dos próprios desejos", async () => {
    const wishA = await prisma.wish.create({
      data: { userId, name: "A", estimatedAmount: 10, categoryId, subcategoryId, priority: 1 },
    });
    const wishB = await prisma.wish.create({
      data: { userId, name: "B", estimatedAmount: 10, categoryId, subcategoryId, priority: 2 },
    });

    const result = await reorderWishesAction({ wishIds: [wishB.id, wishA.id] });
    expect(result.success).toBe(true);

    const reorderedA = await prisma.wish.findUniqueOrThrow({ where: { id: wishA.id } });
    const reorderedB = await prisma.wish.findUniqueOrThrow({ where: { id: wishB.id } });
    expect(reorderedB.priority).toBe(1);
    expect(reorderedA.priority).toBe(2);
  });

  it("rejeita payload com id de desejo de outro usuário (IDOR) e não altera nada", async () => {
    const ownWish = await prisma.wish.create({
      data: { userId, name: "Próprio", estimatedAmount: 10, categoryId, subcategoryId, priority: 5 },
    });
    const otherCategory = await prisma.category.findFirstOrThrow({ where: { userId: otherUserId, parentId: null } });
    const otherSubcategory = await prisma.category.findFirstOrThrow({ where: { userId: otherUserId, parentId: { not: null } } });
    const foreignWish = await prisma.wish.create({
      data: { userId: otherUserId, name: "Estranho", estimatedAmount: 10, categoryId: otherCategory.id, subcategoryId: otherSubcategory.id, priority: 1 },
    });

    const result = await reorderWishesAction({ wishIds: [ownWish.id, foreignWish.id] });
    expect(result.success).toBe(false);

    const untouchedForeign = await prisma.wish.findUniqueOrThrow({ where: { id: foreignWish.id } });
    expect(untouchedForeign.priority).toBe(1);
  });
});

describe("markWishPurchasedAction", () => {
  it("marca como comprado sem lançamento real quando createTransaction é false", async () => {
    const wish = await prisma.wish.create({
      data: { userId, name: "Sem lançamento", estimatedAmount: 50, categoryId, subcategoryId },
    });

    const result = await markWishPurchasedAction({ wishId: wish.id, createTransaction: false });
    expect(result.success).toBe(true);

    const updated = await prisma.wish.findUniqueOrThrow({ where: { id: wish.id } });
    expect(updated.status).toBe("PURCHASED");
    expect(updated.purchasedTransactionId).toBeNull();
  });

  it("cria InstallmentPlan apenas na confirmação de compra com pagamento parcelado", async () => {
    const wish = await prisma.wish.create({
      data: {
        userId,
        name: "Geladeira",
        estimatedAmount: 3000,
        categoryId,
        subcategoryId,
        paymentMethod: "INSTALLMENTS",
        installmentsCount: 6,
        installmentAmount: 500,
      },
    });

    const plansBefore = await prisma.installmentPlan.count({ where: { userId, baseDescription: "Geladeira" } });
    expect(plansBefore).toBe(0);

    const result = await markWishPurchasedAction({
      wishId: wish.id,
      createTransaction: true,
      amount: 3000,
      date: new Date().toISOString(),
    });
    expect(result.success).toBe(true);

    const plan = await prisma.installmentPlan.findFirstOrThrow({ where: { userId, baseDescription: "Geladeira" } });
    expect(plan.totalInstallments).toBe(6);

    const updated = await prisma.wish.findUniqueOrThrow({ where: { id: wish.id } });
    expect(updated.status).toBe("PURCHASED");
    expect(updated.purchasedTransactionId).not.toBeNull();

    const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: updated.purchasedTransactionId! } });
    expect(transaction.installmentPlanId).toBe(plan.id);
    expect(transaction.installmentNumber).toBe(1);
    expect(transaction.accountId).toBe(accountId);
  });

  it("não permite marcar como comprado um desejo de outro usuário (IDOR)", async () => {
    const otherCategory = await prisma.category.findFirstOrThrow({ where: { userId: otherUserId, parentId: null } });
    const otherSubcategory = await prisma.category.findFirstOrThrow({ where: { userId: otherUserId, parentId: { not: null } } });
    const foreignWish = await prisma.wish.create({
      data: { userId: otherUserId, name: "Não é meu", estimatedAmount: 10, categoryId: otherCategory.id, subcategoryId: otherSubcategory.id },
    });

    const result = await markWishPurchasedAction({ wishId: foreignWish.id, createTransaction: false });
    expect(result.success).toBe(false);

    const untouched = await prisma.wish.findUniqueOrThrow({ where: { id: foreignWish.id } });
    expect(untouched.status).toBe("ACTIVE");
  });
});
