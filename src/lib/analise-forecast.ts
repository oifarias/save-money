import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { toMonthKey, toMonthLabel, addMonthsToKey, startOfMonth, addMonthsToDate } from "@/lib/date-month";
import { buildCategoryScope } from "@/lib/analise-data";
import type { ExplorerDataPoint, ExplorerFilters } from "@/lib/analise-data";

export type ForecastHorizon = 1 | 3 | 6;

export type ForecastRationaleLine = {
  key: string;
  label: string;
  amount: number;
  count: number;
};

export type ForecastRationale = {
  expense: ForecastRationaleLine[];
  income: ForecastRationaleLine[];
};

export type ForecastOverrides = {
  expense?: Record<string, number>;
  income?: Record<string, number>;
};

export type ForecastResult = {
  points: ExplorerDataPoint[];
  rationale: ForecastRationale;
  warnings: string[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// Mesmo padrão de getInstallmentCommitmentsByCategoryBatch (budget-data.ts), reproduzido
// aqui pois o escopo é diferente (categoria + subcategoria, sem agrupar por categoria).
// Recebe year/month já parseados do monthKey (o chamador já os tem) em vez de reparsear
// a string a cada chamada — evita um split+map redundante por plano dentro do loop.
// Exportada (só) para ser testada isoladamente — é o núcleo do tapering de parcelas.
export function diffInMonths(year: number, month: number, startDate: Date) {
  return (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
}

/**
 * Média histórica (3 meses fechados anteriores ao mês atual) de um tipo de transação
 * no escopo informado. `count` = número desses 3 meses que tiveram pelo menos uma
 * transação no escopo; `amount` = soma dos meses com dado / count.
 */
async function getHistoricalMonthlyAverage(
  userId: string,
  filters: ExplorerFilters,
  type: "EXPENSE" | "INCOME",
  extraWhere: Prisma.TransactionWhereInput
): Promise<{ amount: number; count: number }> {
  const monthStart = startOfMonth(new Date());
  const pastMonths = [3, 2, 1].map((i) => addMonthsToDate(monthStart, -i));
  const earliestStart = pastMonths[0]!;

  const where: Prisma.TransactionWhereInput = {
    userId,
    type,
    date: { gte: earliestStart, lt: monthStart },
    ...buildCategoryScope(filters),
    ...extraWhere,
  };
  if (filters.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: filters.tagIds } } };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: { amount: true, date: true },
  });

  const sumByMonth = new Map<string, number>();
  const countByMonth = new Map<string, number>();
  for (const t of transactions) {
    const key = toMonthKey(t.date);
    sumByMonth.set(key, (sumByMonth.get(key) ?? 0) + t.amount);
    countByMonth.set(key, (countByMonth.get(key) ?? 0) + 1);
  }

  let totalSum = 0;
  let monthsWithData = 0;
  for (const pastMonth of pastMonths) {
    const key = toMonthKey(pastMonth);
    if ((countByMonth.get(key) ?? 0) > 0) {
      totalSum += sumByMonth.get(key) ?? 0;
      monthsWithData++;
    }
  }

  const amount = monthsWithData > 0 ? totalSum / monthsWithData : 0;
  return { amount, count: monthsWithData };
}

/**
 * Calcula o valor comprometido de parcelamentos por mês futuro, dentro do escopo de
 * categoria/subcategoria informado. Reproduz o padrão de
 * getInstallmentCommitmentsByCategoryBatch (budget-data.ts), mas em escopo
 * categoria+subcategoria (sem agrupar o resultado por categoria) e sem exigir
 * categoryId não-nulo — um plano sem categoria conta normalmente quando não há
 * filtro de categoria ativo.
 */
async function getInstallmentForecastByMonth(
  userId: string,
  filters: ExplorerFilters,
  futureMonthKeys: string[]
): Promise<{ byMonth: Map<string, number>; firstMonthCount: number }> {
  const plans = await prisma.installmentPlan.findMany({
    where: { userId, ...buildCategoryScope(filters) },
    select: {
      totalInstallments: true,
      estimatedAmount: true,
      startDate: true,
      transactions: { select: { installmentNumber: true, date: true } },
    },
  });

  const byMonth = new Map<string, number>();
  let firstMonthCount = 0;

  futureMonthKeys.forEach((monthKey, index) => {
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = new Date(year!, month! - 1, 1);
    const nextMonthStart = new Date(year!, month!, 1);

    let total = 0;
    let count = 0;
    for (const plan of plans) {
      const projectedInstallmentNumber = diffInMonths(year!, month!, plan.startDate) + 1;
      if (projectedInstallmentNumber < 1 || projectedInstallmentNumber > plan.totalInstallments) continue;

      const alreadyLaunchedThisMonth = plan.transactions.some(
        (t) => t.installmentNumber === projectedInstallmentNumber && t.date >= monthStart && t.date < nextMonthStart
      );
      if (alreadyLaunchedThisMonth) continue;

      total += plan.estimatedAmount;
      count++;
    }
    byMonth.set(monthKey, total);
    if (index === 0) firstMonthCount = count;
  });

  return { byMonth, firstMonthCount };
}

type ExpenseForecastPart = {
  fixedAmount: number;
  variableAmount: number;
  installmentsByMonth: Map<string, number>;
  rationale: ForecastRationaleLine[];
  warnings: string[];
};

async function computeExpenseForecast(
  userId: string,
  filters: ExplorerFilters,
  futureMonthKeys: string[]
): Promise<ExpenseForecastPart> {
  const [fixedTemplates, variableStats, installmentForecast] = await Promise.all([
    prisma.fixedExpenseTemplate.findMany({
      where: { userId, isActive: true, ...buildCategoryScope(filters) },
      select: { expectedAmount: true },
    }),
    getHistoricalMonthlyAverage(userId, filters, "EXPENSE", {
      isFixed: false,
      installmentPlanId: null,
    }),
    getInstallmentForecastByMonth(userId, filters, futureMonthKeys),
  ]);

  const fixedAmount = fixedTemplates.reduce((sum, t) => sum + t.expectedAmount, 0);
  const firstMonthInstallmentsAmount = installmentForecast.byMonth.get(futureMonthKeys[0]!) ?? 0;

  return {
    fixedAmount,
    variableAmount: variableStats.amount,
    installmentsByMonth: installmentForecast.byMonth,
    rationale: [
      { key: "fixed", label: "Despesas fixas", amount: round2(fixedAmount), count: fixedTemplates.length },
      {
        key: "installments",
        label: "Parcelamentos previstos (próximo mês)",
        amount: round2(firstMonthInstallmentsAmount),
        count: installmentForecast.firstMonthCount,
      },
      { key: "variable", label: "Gastos variáveis (média histórica)", amount: round2(variableStats.amount), count: variableStats.count },
    ],
    warnings:
      variableStats.count < 3 ? ["Histórico de despesas variáveis insuficiente (menos de 3 meses fechados)"] : [],
  };
}

type IncomeForecastPart = {
  incomeAvgAmount: number;
  rationale: ForecastRationaleLine[];
  warnings: string[];
};

async function computeIncomeForecast(userId: string, filters: ExplorerFilters): Promise<IncomeForecastPart> {
  const incomeStats = await getHistoricalMonthlyAverage(userId, filters, "INCOME", {});
  return {
    incomeAvgAmount: incomeStats.amount,
    rationale: [
      { key: "income_avg", label: "Média de entradas (histórico)", amount: round2(incomeStats.amount), count: incomeStats.count },
    ],
    warnings: incomeStats.count < 3 ? ["Histórico de entradas insuficiente (menos de 3 meses fechados)"] : [],
  };
}

export async function getExplorerForecast(
  userId: string,
  filters: ExplorerFilters,
  monthsAhead: ForecastHorizon,
  overrides?: ForecastOverrides
): Promise<ForecastResult> {
  const currentMonthKey = toMonthKey(new Date());
  const futureMonthKeys = Array.from({ length: monthsAhead }, (_, i) =>
    addMonthsToKey(currentMonthKey, i + 1)
  );

  const includeExpense = filters.type === "EXPENSE" || filters.type === "BOTH";
  const includeIncome = filters.type === "INCOME" || filters.type === "BOTH";

  // Despesas e entradas são independentes uma da outra — computadas em paralelo (em vez de
  // sequencialmente) quando o tipo filtrado é "BOTH", pra não pagar a latência das duas somadas.
  const [expensePart, incomePart] = await Promise.all([
    includeExpense ? computeExpenseForecast(userId, filters, futureMonthKeys) : null,
    includeIncome ? computeIncomeForecast(userId, filters) : null,
  ]);

  const warnings = [...(expensePart?.warnings ?? []), ...(incomePart?.warnings ?? [])];
  const rationale: ForecastRationale = {
    expense: expensePart?.rationale ?? [],
    income: incomePart?.rationale ?? [],
  };

  const effectiveFixed = overrides?.expense?.fixed ?? expensePart?.fixedAmount ?? 0;
  const effectiveVariable = overrides?.expense?.variable ?? expensePart?.variableAmount ?? 0;
  const effectiveIncome = overrides?.income?.income_avg ?? incomePart?.incomeAvgAmount ?? 0;
  const installmentsOverride = overrides?.expense?.installments;
  const installmentsByMonth = expensePart?.installmentsByMonth ?? new Map<string, number>();

  const points: ExplorerDataPoint[] = futureMonthKeys.map((monthKey) => {
    const effectiveInstallmentsForThisMonth =
      installmentsOverride !== undefined
        ? installmentsOverride
        : (installmentsByMonth.get(monthKey) ?? 0);

    const expenseTotal = includeExpense
      ? effectiveFixed + effectiveInstallmentsForThisMonth + effectiveVariable
      : 0;
    const incomeTotal = includeIncome ? effectiveIncome : 0;

    let previsto: number;
    if (filters.type === "EXPENSE") previsto = expenseTotal;
    else if (filters.type === "INCOME") previsto = incomeTotal;
    else previsto = expenseTotal + incomeTotal;

    return {
      label: toMonthLabel(monthKey),
      previsto: round2(previsto),
    };
  });

  return { points, rationale, warnings };
}
