/**
 * Testes de integração (banco real) para getExplorerForecast — cobrem os cenários de cliente
 * da previsão de entradas/saídas na tela de Análise (despesas fixas, parcelamentos, média de
 * entradas e ajuste manual/override).
 *
 * Requer DATABASE_URL apontando pra um Postgres acessível (mesmo requisito dos demais
 * `.cenarios.test.ts` do projeto). Datas são calculadas em relação a "hoje" (não hardcoded),
 * pra o teste continuar válido em qualquer mês em que rodar.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getExplorerForecast } from "@/lib/analise-forecast";
import { startOfMonth, addMonthsToDate } from "@/lib/date-month";
import type { ExplorerFilters } from "@/lib/analise-data";

let userId: string;
let accountId: string;

function baseFilters(overrides: Partial<ExplorerFilters> = {}): ExplorerFilters {
  return {
    categoryIds: [],
    subcategoryIds: [],
    tagIds: [],
    type: "BOTH",
    dateFrom: null,
    dateTo: null,
    period: "all",
    groupBy: "month",
    chartType: "line",
    showValues: true,
    showLegend: true,
    ...overrides,
  };
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Cliente Teste Previsão", email: `analise-forecast-cenarios-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
  accountId = (await prisma.financialAccount.create({ data: { userId, name: "Conta", type: "wallet" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
});

/** dia 5 dos últimos N meses fechados (antes do mês atual), do mais antigo pro mais recente. */
function pastClosedMonths(count: number): Date[] {
  const monthStart = startOfMonth(new Date());
  return Array.from({ length: count }, (_, i) => {
    const start = addMonthsToDate(monthStart, -(count - i));
    return new Date(start.getFullYear(), start.getMonth(), 5);
  });
}

async function seedTransaction(overrides: {
  type: "EXPENSE" | "INCOME";
  amount: number;
  description: string;
  date: Date;
  isFixed?: boolean;
  installmentPlanId?: string;
}) {
  return prisma.transaction.create({
    data: {
      userId,
      accountId,
      type: overrides.type,
      amount: overrides.amount,
      description: overrides.description,
      date: overrides.date,
      isFixed: overrides.isFixed ?? false,
      installmentPlanId: overrides.installmentPlanId ?? null,
    },
  });
}

describe("Cenário: cliente com despesas fixas, 1 parcelamento em andamento e 3 meses de histórico completo", () => {
  it("soma despesas fixas + parcelas do mês + média variável, e usa a média de entradas dos últimos 3 meses", async () => {
    console.log("[cenário] cliente com Aluguel (R$1200) e Internet (R$100) fixos, notebook em 6x de R$250, histórico de 3 meses");

    await prisma.fixedExpenseTemplate.create({
      data: { userId, description: "Aluguel", expectedAmount: 1200, dueDay: 10 },
    });
    await prisma.fixedExpenseTemplate.create({
      data: { userId, description: "Internet", expectedAmount: 100, dueDay: 15 },
    });

    // Parcelamento começando no próximo mês (1ª parcela cai no 1º mês da janela de previsão)
    const nextMonthStart = addMonthsToDate(startOfMonth(new Date()), 1);
    await prisma.installmentPlan.create({
      data: {
        userId,
        baseDescription: "Notebook",
        totalInstallments: 6,
        estimatedAmount: 250,
        startDate: nextMonthStart,
      },
    });

    // Gastos variáveis (nem fixos, nem parcelados) nos últimos 3 meses fechados: R$300/mês
    for (const date of pastClosedMonths(3)) {
      await seedTransaction({ type: "EXPENSE", amount: 300, description: "Variável do mês", date });
    }

    // Entradas (salário) nos últimos 3 meses fechados: R$4000/mês
    for (const date of pastClosedMonths(3)) {
      await seedTransaction({ type: "INCOME", amount: 4000, description: "Salário", date });
    }

    const result = await getExplorerForecast(userId, baseFilters({ type: "BOTH" }), 3);

    expect(result.warnings).toEqual([]);

    const fixedLine = result.rationale.expense.find((l) => l.key === "fixed")!;
    expect(fixedLine.amount).toBe(1300); // 1200 + 100
    expect(fixedLine.count).toBe(2);

    const variableLine = result.rationale.expense.find((l) => l.key === "variable")!;
    expect(variableLine.amount).toBe(300);
    expect(variableLine.count).toBe(3);

    const installmentsLine = result.rationale.expense.find((l) => l.key === "installments")!;
    expect(installmentsLine.amount).toBe(250); // 1ª parcela, próximo mês
    expect(installmentsLine.count).toBe(1);

    const incomeLine = result.rationale.income.find((l) => l.key === "income_avg")!;
    expect(incomeLine.amount).toBe(4000);
    expect(incomeLine.count).toBe(3);

    // 3 meses futuros: fixas (1300) + parcela (250, dentro das 6 parcelas) + variável (300) + entrada (4000)
    expect(result.points).toHaveLength(3);
    for (const point of result.points) {
      expect(point.previsto).toBe(1300 + 250 + 300 + 4000);
    }
  });
});

describe("Cenário: cliente novo, com só 1 mês fechado de histórico de entradas", () => {
  it("emite aviso de histórico insuficiente e calcula a média só com o mês disponível", async () => {
    console.log("[cenário] cliente cadastrou o app há pouco tempo, só tem 1 mês fechado de entradas");
    const [, , mostRecentMonth] = pastClosedMonths(3);
    await seedTransaction({ type: "INCOME", amount: 5000, description: "Salário", date: mostRecentMonth! });

    const result = await getExplorerForecast(userId, baseFilters({ type: "INCOME" }), 1);

    expect(result.warnings).toContain("Histórico de entradas insuficiente (menos de 3 meses fechados)");
    const incomeLine = result.rationale.income.find((l) => l.key === "income_avg")!;
    expect(incomeLine.amount).toBe(5000);
    expect(incomeLine.count).toBe(1);
  });
});

describe("Cenário: cliente ajusta manualmente o valor de despesas fixas na previsão", () => {
  it("usa o valor informado pelo cliente em vez do automático, pra fazer uma projeção mais realista", async () => {
    console.log("[cenário] cliente sabe que vai reduzir o aluguel pra R$900 e ajusta a previsão manualmente");
    await prisma.fixedExpenseTemplate.create({
      data: { userId, description: "Aluguel", expectedAmount: 1200, dueDay: 10 },
    });

    const automatic = await getExplorerForecast(userId, baseFilters({ type: "EXPENSE" }), 1);
    expect(automatic.points[0]!.previsto).toBe(1200);

    const adjusted = await getExplorerForecast(userId, baseFilters({ type: "EXPENSE" }), 1, {
      expense: { fixed: 900 },
    });
    expect(adjusted.points[0]!.previsto).toBe(900);
  });
});
