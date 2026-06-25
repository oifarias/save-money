import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { normalizeInstallments, normalizeFixedFlag } from "@/lib/import-helpers";

const sessionUserId = { current: "" };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionUserId.current ? { user: { id: sessionUserId.current } } : null)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { importTransactionsAction, type ImportRowPayload } from "./import-actions";

let userId: string;
let categoryId: string;
let subcategoryId: string;

async function createUserWithCategory(emailSuffix: string) {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `import-actions-test-${emailSuffix}@example.com`, passwordHash: "x" },
  });
  const category = await prisma.category.create({ data: { userId: user.id, name: "Grupo" } });
  const subcategory = await prisma.category.create({ data: { userId: user.id, name: "Sub-grupo", parentId: category.id } });
  await prisma.financialAccount.create({ data: { userId: user.id, name: "Conta", type: "wallet" } });
  return { user, category, subcategory };
}

function rowFor(overrides: Partial<ImportRowPayload> = {}): ImportRowPayload {
  return {
    date: "2026-06-10",
    description: "Compra",
    amount: "150",
    type: "EXPENSE",
    category: "Grupo",
    subcategory: "Sub-grupo",
    tags: "",
    installments: "",
    isFixed: "",
    ...overrides,
  };
}

beforeAll(async () => {
  const main = await createUserWithCategory(`${Date.now()}-main`);
  userId = main.user.id;
  categoryId = main.category.id;
  subcategoryId = main.subcategory.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  sessionUserId.current = userId;
  // limpa estado entre testes para não vazar transações/planos/templates de um `it` para outro
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
});

describe("importTransactionsAction — comportamento normal (sem installments/isFixed)", () => {
  it("linha sem installments e sem isFixed cria 1 transaction simples", async () => {
    const result = await importTransactionsAction([rowFor({ description: "Mercado" })]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

    const created = await prisma.transaction.findMany({ where: { userId, description: "Mercado" } });
    expect(created).toHaveLength(1);
    expect(created[0].installmentPlanId).toBeNull();
    expect(created[0].fixedExpenseTemplateId).toBeNull();
    expect(created[0].isFixed).toBe(false);
    expect(created[0].categoryId).toBe(categoryId);
    expect(created[0].subcategoryId).toBe(subcategoryId);
  });
});

describe("importTransactionsAction — installments", () => {
  it('linha com installments "3/12" gera 10 transactions (parcelas 3 a 12) com mesmo plano e valor', async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Notebook", amount: "200", date: "2026-06-10", installments: "3/12" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(10);
    expect(result.skipped).toBe(0);

    const created = await prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: "Notebook" } },
      orderBy: { installmentNumber: "asc" },
    });

    expect(created).toHaveLength(10);
    expect(created.map((t) => t.installmentNumber)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(created.every((t) => t.installmentPlanId === created[0].installmentPlanId)).toBe(true);
    expect(created.every((t) => t.amount === 200)).toBe(true);
    expect(created.map((t) => t.description)).toEqual([
      "Notebook (3/12)",
      "Notebook (4/12)",
      "Notebook (5/12)",
      "Notebook (6/12)",
      "Notebook (7/12)",
      "Notebook (8/12)",
      "Notebook (9/12)",
      "Notebook (10/12)",
      "Notebook (11/12)",
      "Notebook (12/12)",
    ]);

    const first = created[0]; // parcela 3
    const last = created[created.length - 1]; // parcela 12
    const monthsDiff =
      (last.date.getFullYear() - first.date.getFullYear()) * 12 + (last.date.getMonth() - first.date.getMonth());
    expect(monthsDiff).toBe(9);
  });

  it('linha com installments "1/4" gera 4 transactions (1 a 4), sem tentar criar parcelas "anteriores"', async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Sofá", amount: "100", date: "2026-01-15", installments: "1/4" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(4);

    const created = await prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: "Sofá" } },
      orderBy: { installmentNumber: "asc" },
    });

    expect(created).toHaveLength(4);
    expect(created.map((t) => t.installmentNumber)).toEqual([1, 2, 3, 4]);
  });

  it.each(["abc", "12/3", "0/5", "5/1", "  "])(
    'linha com installments inválido "%s" é invalidada (skipped, sem transaction criada)',
    async (invalidInstallments) => {
      const result = await importTransactionsAction([
        rowFor({ description: `Inválido ${invalidInstallments}`, installments: invalidInstallments }),
      ]);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);

      const created = await prisma.transaction.findMany({
        where: { userId, description: `Inválido ${invalidInstallments}` },
      });
      expect(created).toHaveLength(0);
    }
  );
});

describe("importTransactionsAction — isFixed", () => {
  it('linha com isFixed "sim" cria 1 transaction com isFixed true e fixedExpenseTemplateId setado', async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Aluguel", amount: "1500", date: "2026-06-05", isFixed: "sim" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

    const created = await prisma.transaction.findMany({ where: { userId, description: "Aluguel" } });
    expect(created).toHaveLength(1);
    expect(created[0].isFixed).toBe(true);
    expect(created[0].fixedExpenseTemplateId).not.toBeNull();

    const template = await prisma.fixedExpenseTemplate.findUnique({
      where: { id: created[0].fixedExpenseTemplateId! },
    });
    expect(template).not.toBeNull();
    expect(template!.description).toBe("Aluguel");
    expect(template!.categoryId).toBe(categoryId);
    expect(template!.isActive).toBe(true);
  });

  it("duas linhas isFixed com mesma descrição e categoria reaproveitam o mesmo FixedExpenseTemplate", async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Internet", amount: "120", date: "2026-05-10", isFixed: "true" }),
      rowFor({ description: "Internet", amount: "120", date: "2026-06-10", isFixed: "true" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);

    const created = await prisma.transaction.findMany({
      where: { userId, description: "Internet" },
      orderBy: { date: "asc" },
    });
    expect(created).toHaveLength(2);
    expect(created[0].fixedExpenseTemplateId).not.toBeNull();
    expect(created[0].fixedExpenseTemplateId).toBe(created[1].fixedExpenseTemplateId);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId, description: "Internet" } });
    expect(templates).toHaveLength(1);
  });
});

describe("importTransactionsAction — installments e isFixed na mesma linha (prioriza parcelas)", () => {
  it('linha com installments "3/12" e isFixed "true" simultaneamente gera as parcelas normalmente, ignorando isFixed', async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Conflito", amount: "200", date: "2026-06-10", installments: "3/12", isFixed: "true" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(10);
    expect(result.skipped).toBe(0);

    const created = await prisma.transaction.findMany({ where: { userId, installmentPlan: { baseDescription: "Conflito" } } });
    expect(created).toHaveLength(10);
    expect(created.every((t) => t.isFixed === false)).toBe(true);
    expect(created.every((t) => t.fixedExpenseTemplateId === null)).toBe(true);

    const plans = await prisma.installmentPlan.findMany({ where: { userId, baseDescription: "Conflito" } });
    expect(plans).toHaveLength(1);
  });

  it("lote misto: linha válida + linha com installments e isFixed reporta imported somando as parcelas geradas", async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Linha válida", amount: "50" }),
      rowFor({ description: "Linha com ambos", amount: "30", date: "2026-06-10", installments: "2/3", isFixed: "sim" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(1 + 2);
    expect(result.skipped).toBe(0);
  });
});

describe("normalizeInstallments (unitário, sem banco)", () => {
  it("parseia formatos válidos", () => {
    expect(normalizeInstallments("3/12")).toEqual({ current: 3, total: 12 });
    expect(normalizeInstallments("1/4")).toEqual({ current: 1, total: 4 });
    expect(normalizeInstallments(" 3/12 ")).toEqual({ current: 3, total: 12 });
  });

  it("rejeita formatos inválidos", () => {
    expect(normalizeInstallments("")).toBeNull();
    expect(normalizeInstallments("   ")).toBeNull();
    expect(normalizeInstallments("abc")).toBeNull();
    expect(normalizeInstallments("12/3")).toBeNull(); // current > total
    expect(normalizeInstallments("0/5")).toBeNull(); // current < 1
    expect(normalizeInstallments("5/1")).toBeNull(); // total <= 1
    expect(normalizeInstallments("1/1")).toBeNull(); // total <= 1
    expect(normalizeInstallments("3.5/12")).toBeNull();
    expect(normalizeInstallments("3/12/1")).toBeNull();
  });
});

describe("normalizeFixedFlag (unitário, sem banco)", () => {
  it("reconhece valores verdadeiros, incluindo variações de case e espaços", () => {
    expect(normalizeFixedFlag("sim")).toBe(true);
    expect(normalizeFixedFlag("SIM")).toBe(true);
    expect(normalizeFixedFlag("Sim")).toBe(true);
    expect(normalizeFixedFlag("true")).toBe(true);
    expect(normalizeFixedFlag("True")).toBe(true);
    expect(normalizeFixedFlag("1")).toBe(true);
    expect(normalizeFixedFlag("x")).toBe(true);
    expect(normalizeFixedFlag("s")).toBe(true);
    expect(normalizeFixedFlag("yes")).toBe(true);
    expect(normalizeFixedFlag("y")).toBe(true);
    expect(normalizeFixedFlag("  sim  ")).toBe(true);
  });

  it("rejeita valores falsos/vazios/desconhecidos", () => {
    expect(normalizeFixedFlag("")).toBe(false);
    expect(normalizeFixedFlag("   ")).toBe(false);
    expect(normalizeFixedFlag("nao")).toBe(false);
    expect(normalizeFixedFlag("false")).toBe(false);
    expect(normalizeFixedFlag("0")).toBe(false);
    expect(normalizeFixedFlag("talvez")).toBe(false);
  });
});
