/**
 * Testes de integração cobrindo os cenários documentados em
 * description-features/cenarios-criacao-despesas.md.
 *
 * actions.test.ts já cobre Cenário 1A (simples), 1E (parcelado via flag),
 * updateTransactionAction (cascata) e deleteTransactionAction.
 * Este arquivo cobre os cenários restantes.
 */
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
  createTransactionAction,
  payFixedExpensesAction,
  acceptFixedExpenseInsightAction,
  createTransactionBatchAction,
} from "./actions";

let userId: string;
let otherUserId: string;
let categoryId: string;
let subcategoryId: string;

async function createUserWithCategory(emailSuffix: string) {
  const user = await prisma.user.create({
    data: { name: "Teste Cenários", email: `actions-cenarios-${emailSuffix}@example.com`, passwordHash: "x" },
  });
  const category = await prisma.category.create({ data: { userId: user.id, name: "Grupo" } });
  const subcategory = await prisma.category.create({ data: { userId: user.id, name: "Sub-grupo", parentId: category.id } });
  await prisma.financialAccount.create({ data: { userId: user.id, name: "Conta", type: "wallet" } });
  return { user, category, subcategory };
}

function formDataFor(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

function baseExpenseFields(overrides: Record<string, string> = {}) {
  return {
    type: "EXPENSE",
    date: "2026-06-10",
    description: "Aluguel",
    amount: "1200",
    categoryId,
    subcategoryId,
    recurrence: "NONE",
    tags: JSON.stringify([]),
    ...overrides,
  };
}

function baseIncomeFields(overrides: Record<string, string> = {}) {
  return {
    type: "INCOME",
    date: "2026-06-10",
    description: "Salário",
    amount: "5000",
    categoryId,
    subcategoryId,
    recurrence: "NONE",
    tags: JSON.stringify([]),
    ...overrides,
  };
}

function batchItem(overrides: Partial<{
  type: string; date: string; description: string; amount: string;
  categoryId: string; subcategoryId: string; isFixed: boolean;
  recurrence: string; tags: string[]; isInstallment: boolean; totalInstallments: string;
}> = {}) {
  return {
    type: "EXPENSE",
    date: "2026-06-10",
    description: "Item lote",
    amount: "100",
    categoryId,
    subcategoryId: "",
    isFixed: false,
    recurrence: "NONE",
    tags: [],
    isInstallment: false,
    totalInstallments: "",
    ...overrides,
  };
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

beforeEach(async () => {
  sessionUserId.current = userId;
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
});

// ─── Cenário 1B — Despesa fixa (nova) ───────────────────────────────────────

describe("Cenário 1B — createTransactionAction: despesa fixa nova cria FixedExpenseTemplate", () => {
  it("grava isFixed=true e cria um FixedExpenseTemplate vinculado à transaction", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ isFixed: "on", description: "Aluguel" }))
    );

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Aluguel" } });
    expect(transaction).not.toBeNull();
    expect(transaction!.isFixed).toBe(true);
    expect(transaction!.fixedExpenseTemplateId).not.toBeNull();

    const template = await prisma.fixedExpenseTemplate.findUnique({ where: { id: transaction!.fixedExpenseTemplateId! } });
    expect(template).not.toBeNull();
    expect(template!.userId).toBe(userId);
    expect(template!.isActive).toBe(true);
    expect(template!.expectedAmount).toBe(1200);
  });

  it("não cria FixedExpenseTemplate quando isFixed=false (despesa variável)", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Mercado" }))
    );

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Mercado" } });
    expect(transaction!.isFixed).toBe(false);
    expect(transaction!.fixedExpenseTemplateId).toBeNull();
    const templateCount = await prisma.fixedExpenseTemplate.count({ where: { userId } });
    expect(templateCount).toBe(0);
  });
});

// ─── Cenário 1C — Despesa fixa (reutiliza template existente) ────────────────

describe("Cenário 1C — createTransactionAction: despesa fixa reutiliza template existente", () => {
  it("duas transações fixas com mesma descrição compartilham o mesmo FixedExpenseTemplate", async () => {
    await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ isFixed: "on", description: "Internet" }))
    );
    await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ isFixed: "on", description: "Internet", date: "2026-07-10" }))
    );

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(1);

    const transactions = await prisma.transaction.findMany({ where: { userId, description: "Internet" } });
    expect(transactions).toHaveLength(2);
    expect(transactions[0].fixedExpenseTemplateId).toBe(templates[0].id);
    expect(transactions[1].fixedExpenseTemplateId).toBe(templates[0].id);
  });
});

// ─── Cenário 1D — Despesa com recurrence ─────────────────────────────────────

describe("Cenário 1D — createTransactionAction: recurrence é armazenado sem gerar transações adicionais", () => {
  it("recurrence MONTHLY é salvo na transaction e não gera novas transações", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Assinatura", recurrence: "MONTHLY" }))
    );

    expect(result.success).toBe(true);

    const transactions = await prisma.transaction.findMany({ where: { userId, description: "Assinatura" } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].recurrence).toBe("MONTHLY");
    expect(transactions[0].installmentPlanId).toBeNull();
  });

  it("recurrence WEEKLY é salvo na transaction e não gera novas transações", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Academia", recurrence: "WEEKLY" }))
    );

    expect(result.success).toBe(true);

    const transactions = await prisma.transaction.findMany({ where: { userId, description: "Academia" } });
    expect(transactions).toHaveLength(1);
    expect(transactions[0].recurrence).toBe("WEEKLY");
  });
});

// ─── Cenário 1F — Despesa parcelada via regex na descrição ───────────────────

describe("Cenário 1F — createTransactionAction: despesa parcelada por padrão (x/N) na descrição", () => {
  it("descrição com padrão '(2/6)' cria ou vincula um InstallmentPlan automaticamente", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Notebook (2/6)", amount: "600" }))
    );

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Notebook (2/6)" } });
    expect(transaction).not.toBeNull();
    expect(transaction!.installmentPlanId).not.toBeNull();
    expect(transaction!.installmentNumber).toBe(2);

    const plan = await prisma.installmentPlan.findUnique({ where: { id: transaction!.installmentPlanId! } });
    expect(plan).not.toBeNull();
    expect(plan!.totalInstallments).toBe(6);
    expect(plan!.baseDescription).toBe("Notebook");
  });

  it("segunda transação com mesmo padrão '(3/6)' reutiliza o mesmo plano", async () => {
    await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Notebook (2/6)", amount: "600" }))
    );
    await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ description: "Notebook (3/6)", amount: "600", date: "2026-07-10" }))
    );

    const plans = await prisma.installmentPlan.findMany({ where: { userId, baseDescription: "Notebook" } });
    expect(plans).toHaveLength(1);

    const transactions = await prisma.transaction.findMany({
      where: { userId, installmentPlanId: plans[0].id },
      orderBy: { installmentNumber: "asc" },
    });
    expect(transactions).toHaveLength(2);
    expect(transactions.map((t) => t.installmentNumber)).toEqual([2, 3]);
  });
});

// ─── INCOME: entrada fixa salva isFixed=true e NÃO cria FixedExpenseTemplate ─

describe("INCOME — createTransactionAction: entrada fixa (isFixed=true) não cria FixedExpenseTemplate", () => {
  it("entrada fixa: isFixed=true é salvo, mas nenhum FixedExpenseTemplate é criado", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseIncomeFields({ isFixed: "on", description: "Salário" }))
    );

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Salário" } });
    expect(transaction).not.toBeNull();
    expect(transaction!.type).toBe("INCOME");
    expect(transaction!.isFixed).toBe(true);
    expect(transaction!.fixedExpenseTemplateId).toBeNull();

    const templateCount = await prisma.fixedExpenseTemplate.count({ where: { userId } });
    expect(templateCount).toBe(0);
  });

  it("entrada variável: isFixed=false, sem template, tipo correto", async () => {
    const result = await createTransactionAction(
      { success: false },
      formDataFor(baseIncomeFields({ description: "Pix de amigo" }))
    );

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Pix de amigo" } });
    expect(transaction!.type).toBe("INCOME");
    expect(transaction!.isFixed).toBe(false);
    expect(transaction!.fixedExpenseTemplateId).toBeNull();
  });

  it("entrada fixa não cria FixedExpenseTemplate mesmo quando enviada junto com uma despesa fixa", async () => {
    await createTransactionAction(
      { success: false },
      formDataFor(baseExpenseFields({ isFixed: "on", description: "Aluguel pago" }))
    );
    await createTransactionAction(
      { success: false },
      formDataFor(baseIncomeFields({ isFixed: "on", description: "Salário recebido" }))
    );

    const templateCount = await prisma.fixedExpenseTemplate.count({ where: { userId } });
    expect(templateCount).toBe(1);

    const template = await prisma.fixedExpenseTemplate.findFirst({ where: { userId } });
    expect(template!.description).toContain("Aluguel pago");
  });
});

// ─── Cenário 2 — createTransactionBatchAction (lançamento em lote) ────────────

describe("Cenário 2 — createTransactionBatchAction: lançamento em lote", () => {
  it("lote com 3 despesas simples cria 3 transactions e retorna mensagem com contagem", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ description: "Item 1" }),
      batchItem({ description: "Item 2" }),
      batchItem({ description: "Item 3" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.message).toContain("3");

    const created = await prisma.transaction.findMany({ where: { userId } });
    expect(created).toHaveLength(3);
  });

  it("item de despesa fixa no lote cria FixedExpenseTemplate para esse item", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ description: "Item simples" }),
      batchItem({ description: "Internet fixa", isFixed: true }),
    ]);

    expect(result.success).toBe(true);

    const fixedTransaction = await prisma.transaction.findFirst({ where: { userId, description: "Internet fixa" } });
    expect(fixedTransaction!.isFixed).toBe(true);
    expect(fixedTransaction!.fixedExpenseTemplateId).not.toBeNull();

    const simpleTransaction = await prisma.transaction.findFirst({ where: { userId, description: "Item simples" } });
    expect(simpleTransaction!.isFixed).toBe(false);
    expect(simpleTransaction!.fixedExpenseTemplateId).toBeNull();

    const templateCount = await prisma.fixedExpenseTemplate.count({ where: { userId } });
    expect(templateCount).toBe(1);
  });

  it("item parcelado no lote cria InstallmentPlan e N transactions, demais itens são normais", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ description: "Celular parcelado", isInstallment: true, totalInstallments: "6" }),
      batchItem({ description: "Simples junto" }),
    ]);

    expect(result.success).toBe(true);
    expect(result.message).toContain("7");

    const plan = await prisma.installmentPlan.findFirst({ where: { userId, baseDescription: "Celular parcelado" } });
    expect(plan).not.toBeNull();
    expect(plan!.totalInstallments).toBe(6);

    const installmentTransactions = await prisma.transaction.findMany({ where: { userId, installmentPlanId: plan!.id } });
    expect(installmentTransactions).toHaveLength(6);

    const simpleTransaction = await prisma.transaction.findFirst({ where: { userId, description: "Simples junto" } });
    expect(simpleTransaction).not.toBeNull();
    expect(simpleTransaction!.installmentPlanId).toBeNull();
  });

  it("entrada fixa no lote: isFixed=true é salvo, mas nenhum FixedExpenseTemplate é criado", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ type: "INCOME", description: "Salário lote", isFixed: true, amount: "5000" }),
    ]);

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Salário lote" } });
    expect(transaction!.type).toBe("INCOME");
    expect(transaction!.isFixed).toBe(true);
    expect(transaction!.fixedExpenseTemplateId).toBeNull();

    const templateCount = await prisma.fixedExpenseTemplate.count({ where: { userId } });
    expect(templateCount).toBe(0);
  });

  it("tags do item de lote são criadas e vinculadas à transaction", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ description: "Mercado com tags", tags: ["casa", "comida"] }),
    ]);

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({
      where: { userId, description: "Mercado com tags" },
      include: { tags: { include: { tag: true } } },
    });
    expect(transaction).not.toBeNull();
    const tagNames = transaction!.tags.map((t) => t.tag.name).sort();
    expect(tagNames).toEqual(["casa", "comida"]);
  });

  it("lote vazio é rejeitado pelo schema (mínimo 1 item)", async () => {
    const result = await createTransactionBatchAction([]);
    expect(result.success).toBe(false);
  });

  it("lote com mais de 50 itens é rejeitado pelo schema", async () => {
    const items = Array.from({ length: 51 }, (_, i) => batchItem({ description: `Item ${i + 1}` }));
    const result = await createTransactionBatchAction(items);
    expect(result.success).toBe(false);
  });

  it("item inválido no lote (amount negativo) rejeita o lote inteiro — nenhuma transaction é criada", async () => {
    const result = await createTransactionBatchAction([
      batchItem({ description: "Item bom" }),
      batchItem({ description: "Item inválido", amount: "-1" }),
    ]);

    expect(result.success).toBe(false);

    const created = await prisma.transaction.findMany({ where: { userId } });
    expect(created).toHaveLength(0);
  });
});

// ─── Cenário 4 — payFixedExpensesAction (checklist: marcar como paga) ────────

describe("Cenário 4 — payFixedExpensesAction: marcar despesa fixa como paga", () => {
  async function createTemplate(description: string) {
    const template = await prisma.fixedExpenseTemplate.create({
      data: {
        userId,
        description,
        expectedAmount: 800,
        dueDay: 5,
        isActive: true,
      },
    });
    return template;
  }

  beforeEach(async () => {
    await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
  });

  it("cria transaction com referenceMonth, isFixed=true e fixedExpenseTemplateId correto", async () => {
    const template = await createTemplate("Aluguel mensal");

    const result = await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-05", paidAmount: 800 },
    ]);

    expect(result.success).toBe(true);

    const transaction = await prisma.transaction.findFirst({
      where: { userId, fixedExpenseTemplateId: template.id },
    });
    expect(transaction).not.toBeNull();
    expect(transaction!.isFixed).toBe(true);
    expect(transaction!.referenceMonth).toBe("2026-06");
    expect(transaction!.fixedExpenseTemplateId).toBe(template.id);
    expect(transaction!.type).toBe("EXPENSE");
  });

  it("paidAmount diferente do expectedAmount do template é aceito", async () => {
    const template = await createTemplate("Condomínio");

    await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-10", paidAmount: 950 },
    ]);

    const transaction = await prisma.transaction.findFirst({ where: { userId, fixedExpenseTemplateId: template.id } });
    expect(transaction!.amount).toBe(950);
  });

  it("pagamento duplicado no mesmo mês é bloqueado (constraint P2002) e retorna falha", async () => {
    const template = await createTemplate("Streaming");

    await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-01", paidAmount: 45 },
    ]);

    const result = await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-15", paidAmount: 45 },
    ]);

    expect(result.success).toBe(false);
    expect(result.message).toContain("já estava");

    const count = await prisma.transaction.count({ where: { userId, fixedExpenseTemplateId: template.id } });
    expect(count).toBe(1);
  });

  it("pagamentos em meses diferentes são ambos aceitos", async () => {
    const template = await createTemplate("Seguro");

    await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-05-05", paidAmount: 200 },
    ]);
    const result = await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-05", paidAmount: 200 },
    ]);

    expect(result.success).toBe(true);
    const count = await prisma.transaction.count({ where: { userId, fixedExpenseTemplateId: template.id } });
    expect(count).toBe(2);
  });

  it("template inexistente: action retorna falha e não cria transaction", async () => {
    const result = await payFixedExpensesAction([
      { templateId: "template-nao-existe", paidDate: "2026-06-05", paidAmount: 100 },
    ]);

    expect(result.success).toBe(false);
    expect(result.message).toContain("não foi");

    const count = await prisma.transaction.count({ where: { userId } });
    expect(count).toBe(0);
  });

  it("não permite pagar template de outro usuário (IDOR)", async () => {
    sessionUserId.current = otherUserId;
    const foreignTemplate = await prisma.fixedExpenseTemplate.create({
      data: {
        userId: otherUserId,
        description: "Template do outro",
        expectedAmount: 500,
        dueDay: 10,
        isActive: true,
      },
    });

    sessionUserId.current = userId;
    const result = await payFixedExpensesAction([
      { templateId: foreignTemplate.id, paidDate: "2026-06-10", paidAmount: 500 },
    ]);

    expect(result.success).toBe(false);

    const count = await prisma.transaction.count({ where: { userId: otherUserId } });
    expect(count).toBe(0);

    await prisma.fixedExpenseTemplate.deleteMany({ where: { userId: otherUserId } });
  });

  it("lote misto: item válido é processado, item inexistente reporta notFound sem abortar o lote", async () => {
    const template = await createTemplate("Plano saúde");

    const result = await payFixedExpensesAction([
      { templateId: template.id, paidDate: "2026-06-05", paidAmount: 300 },
      { templateId: "nao-existe-xpto", paidDate: "2026-06-05", paidAmount: 100 },
    ]);

    expect(result.success).toBe(false);
    expect(result.message).toContain("1");

    const count = await prisma.transaction.count({ where: { userId, fixedExpenseTemplateId: template.id } });
    expect(count).toBe(1);
  });
});

// ─── Cenário 5 — acceptFixedExpenseInsightAction ─────────────────────────────

describe("Cenário 5 — acceptFixedExpenseInsightAction: aceitar insight de despesa fixa", () => {
  async function createPlainTransaction(description: string, amount: number, date: string) {
    return prisma.transaction.create({
      data: {
        userId,
        accountId: await getAccountId(),
        type: "EXPENSE",
        amount,
        date: new Date(date),
        description,
        isFixed: false,
        recurrence: "NONE",
      },
    });
  }

  async function getAccountId() {
    const account = await prisma.financialAccount.findFirst({ where: { userId } });
    return account!.id;
  }

  it("marca todas as transactions do grupo como isFixed=true e cria FixedExpenseTemplate para cada uma", async () => {
    const t1 = await createPlainTransaction("Netflix", 39, "2026-04-10");
    const t2 = await createPlainTransaction("Netflix", 39, "2026-05-10");

    const result = await acceptFixedExpenseInsightAction("netflix-group", [t1.id, t2.id]);

    expect(result.success).toBe(true);
    expect(result.message).toContain("2");

    const updated = await prisma.transaction.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    expect(updated.every((t) => t.isFixed === true)).toBe(true);
    expect(updated.every((t) => t.fixedExpenseTemplateId !== null)).toBe(true);
  });

  it("cria FixedExpenseInsightDecision com status 'accepted' e os transactionIds corretos", async () => {
    const t1 = await createPlainTransaction("Spotify", 22, "2026-04-15");
    const t2 = await createPlainTransaction("Spotify", 22, "2026-05-15");

    await acceptFixedExpenseInsightAction("spotify-group", [t1.id, t2.id]);

    const decision = await prisma.fixedExpenseInsightDecision.findFirst({
      where: { userId, groupKey: "spotify-group" },
    });
    expect(decision).not.toBeNull();
    expect(decision!.status).toBe("accepted");
    expect(decision!.transactionIds).toEqual(expect.arrayContaining([t1.id, t2.id]));
  });

  it("transactions do mesmo grupo compartilham o mesmo FixedExpenseTemplate (não cria um por transação)", async () => {
    const t1 = await createPlainTransaction("Adobe CC", 55, "2026-04-20");
    const t2 = await createPlainTransaction("Adobe CC", 55, "2026-05-20");

    await acceptFixedExpenseInsightAction("adobe-group", [t1.id, t2.id]);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(1);

    const updated = await prisma.transaction.findMany({ where: { id: { in: [t1.id, t2.id] } } });
    expect(updated[0].fixedExpenseTemplateId).toBe(updated[1].fixedExpenseTemplateId);
  });

  it("não permite aceitar insight com transactions de outro usuário (IDOR)", async () => {
    sessionUserId.current = otherUserId;
    const otherAccount = await prisma.financialAccount.findFirst({ where: { userId: otherUserId } });
    const foreignTransaction = await prisma.transaction.create({
      data: {
        userId: otherUserId,
        accountId: otherAccount!.id,
        type: "EXPENSE",
        amount: 100,
        date: new Date("2026-04-10"),
        description: "Despesa de outro",
        isFixed: false,
        recurrence: "NONE",
      },
    });

    sessionUserId.current = userId;
    const result = await acceptFixedExpenseInsightAction("foreign-group", [foreignTransaction.id]);

    expect(result.success).toBe(false);

    const unchanged = await prisma.transaction.findUnique({ where: { id: foreignTransaction.id } });
    expect(unchanged!.isFixed).toBe(false);

    await prisma.transaction.deleteMany({ where: { userId: otherUserId } });
  });

  it("grupo com transações de categorias diferentes aplica a categoria mais frequente para todas", async () => {
    const catA = await prisma.category.create({ data: { userId, name: "Lazer" } });
    const catB = await prisma.category.create({ data: { userId, name: "Moradia" } });

    const accountId = await getAccountId();
    const t1 = await prisma.transaction.create({
      data: { userId, accountId, type: "EXPENSE", amount: 30, date: new Date("2026-03-10"), description: "YouTube", isFixed: false, recurrence: "NONE", categoryId: catA.id },
    });
    const t2 = await prisma.transaction.create({
      data: { userId, accountId, type: "EXPENSE", amount: 30, date: new Date("2026-04-10"), description: "YouTube", isFixed: false, recurrence: "NONE", categoryId: catA.id },
    });
    const t3 = await prisma.transaction.create({
      data: { userId, accountId, type: "EXPENSE", amount: 30, date: new Date("2026-05-10"), description: "YouTube", isFixed: false, recurrence: "NONE", categoryId: catB.id },
    });

    await acceptFixedExpenseInsightAction("youtube-group", [t1.id, t2.id, t3.id]);

    const updated = await prisma.transaction.findMany({ where: { id: { in: [t1.id, t2.id, t3.id] } } });
    expect(updated.every((t) => t.categoryId === catA.id)).toBe(true);
  });
});
