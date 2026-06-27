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

import { importTransactionsAction, type ImportRowPayload } from "@/app/(app)/lancamentos/import-actions";

let userId: string;

function rowFor(overrides: Partial<ImportRowPayload> = {}): ImportRowPayload {
  return {
    date: "2026-06-10",
    description: "Compra",
    amount: "150",
    type: "EXPENSE",
    category: "",
    subcategory: "",
    tags: "",
    installments: "",
    isFixed: "",
    ...overrides,
  };
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `import-batch-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
  await prisma.financialAccount.create({ data: { userId, name: "Conta", type: "wallet" } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  sessionUserId.current = userId;
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
  await prisma.tag.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
});

describe("importTransactionsAction — pipeline em batch", () => {
  it("50 linhas simples com 3 categorias distintas e 5 tags cria tudo corretamente em batch", async () => {
    const categories = ["Alimentação", "Transporte", "Lazer"];
    const tagPool = ["a", "b", "c", "d", "e"];

    const rows = Array.from({ length: 50 }, (_, i) =>
      rowFor({
        description: `Linha ${i}`,
        category: categories[i % categories.length],
        tags: `${tagPool[i % tagPool.length]},${tagPool[(i + 1) % tagPool.length]}`,
      })
    );

    const result = await importTransactionsAction(rows);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(50);
    expect(result.skipped).toBe(0);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(50);

    const createdCategories = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(createdCategories).toHaveLength(3);

    const createdTags = await prisma.tag.findMany({ where: { userId } });
    expect(createdTags).toHaveLength(5);

    const tagLinks = await prisma.transactionTag.count({ where: { transaction: { userId } } });
    expect(tagLinks).toBe(100); // 50 linhas x 2 tags cada
  });

  it("100 linhas isFixed=true cria as transactions e reaproveita templates por descrição", async () => {
    const rows = Array.from({ length: 100 }, (_, i) =>
      rowFor({ description: i % 2 === 0 ? "Aluguel" : "Internet", isFixed: "sim", category: "Moradia" })
    );

    const result = await importTransactionsAction(rows);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(100);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions.every((t) => t.isFixed)).toBe(true);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(2); // Aluguel + Internet
  });

  it('1 linha "3/12" gera 10 transactions e 1 InstallmentPlan com totalInstallments=12', async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Notebook", amount: "200", installments: "3/12" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(10);

    const plans = await prisma.installmentPlan.findMany({ where: { userId, baseDescription: "Notebook" } });
    expect(plans).toHaveLength(1);
    expect(plans[0].totalInstallments).toBe(12);

    const transactions = await prisma.transaction.findMany({ where: { userId, installmentPlanId: plans[0].id } });
    expect(transactions).toHaveLength(10);
  });

  it("3 linhas do mesmo plano (2/6, 3/6, 4/6) na mesma planilha criam apenas 1 InstallmentPlan", async () => {
    const result = await importTransactionsAction([
      rowFor({ description: "Sofá", amount: "100", date: "2026-02-10", installments: "2/6" }),
      rowFor({ description: "Sofá", amount: "100", date: "2026-03-10", installments: "3/6" }),
      rowFor({ description: "Sofá", amount: "100", date: "2026-04-10", installments: "4/6" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(3 + 4 + 5); // parcelas 2..6, 3..6, 4..6 materializadas por linha

    const plans = await prisma.installmentPlan.findMany({ where: { userId, baseDescription: "Sofá" } });
    expect(plans).toHaveLength(1);
  });

  it("mix de 50 simples + 5 parceladas (2/12 cada) importa o total esperado", async () => {
    const simpleRows = Array.from({ length: 50 }, (_, i) => rowFor({ description: `Simples ${i}` }));
    const installmentRows = Array.from({ length: 5 }, (_, i) =>
      rowFor({ description: `Parcelado ${i}`, amount: "200", installments: "2/12" })
    );

    const result = await importTransactionsAction([...simpleRows, ...installmentRows]);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(50 + 5 * 11); // 2..12 = 11 parcelas por plano

    const plans = await prisma.installmentPlan.count({ where: { userId } });
    expect(plans).toBe(5);
  });

  it("linha inválida no meio do lote é contabilizada em skipped sem travar as demais", async () => {
    const rows = [
      rowFor({ description: "Válida 1" }),
      rowFor({ description: "Inválida", amount: "" }),
      rowFor({ description: "Válida 2" }),
    ];

    const result = await importTransactionsAction(rows);

    expect(result.success).toBe(true);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(2);
  });

  it("lote vazio retorna success: false sem nenhuma escrita no banco", async () => {
    const result = await importTransactionsAction([]);

    expect(result.success).toBe(false);

    const transactions = await prisma.transaction.findMany({ where: { userId } });
    expect(transactions).toHaveLength(0);
  });

  it("mesma categoria importada em duas linhas diferentes cria só 1 registro (idempotência)", async () => {
    await importTransactionsAction([
      rowFor({ description: "Linha A", category: "Saúde" }),
      rowFor({ description: "Linha B", category: "Saúde" }),
    ]);

    const categories = await prisma.category.findMany({ where: { userId, name: "Saúde" } });
    expect(categories).toHaveLength(1);
  });

  it("mesma tag em 20 linhas diferentes cria só 1 tag e 20 vínculos", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => rowFor({ description: `Linha ${i}`, tags: "recorrente" }));

    await importTransactionsAction(rows);

    const tags = await prisma.tag.findMany({ where: { userId, name: "recorrente" } });
    expect(tags).toHaveLength(1);

    const links = await prisma.transactionTag.count({ where: { tagId: tags[0].id } });
    expect(links).toBe(20);
  });
});
