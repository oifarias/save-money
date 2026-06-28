import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";
import { getFixedExpensesChecklist } from "@/lib/fixed-expenses-data";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type CategorySlice = {
  id: string;
  name: string;
  color: string;
  value: number;
};

export type MonthlyTrendPoint = {
  key: string;
  label: string;
  income: number;
  expense: number;
};

export type Insight = {
  id: string;
  tone: "info" | "warning" | "success";
  title: string;
  description: string;
};

export type InstallmentTotals = {
  currentMonth: number;
  currentMonthCount: number;
  remaining: number;
  remainingCount: number;
  lastInstallmentPlansCount: number;
  lastInstallmentAmount: number;
};

export type IncomeBreakdown = {
  fixedTotal: number;
  fixedCount: number;
  variableTotal: number;
  variableCount: number;
};

export type ExpenseBreakdown = {
  fixedTotal: number;
  fixedCount: number;
  variableTotal: number;
  variableCount: number;
};

export type FixedExpenseTemplatesTotals = {
  pendingTotal: number;
  paidTotal: number;
  pendingCount: number;
  paidCount: number;
};

export type DashboardData = {
  totals: {
    income: number;
    expense: number;
    balance: number;
    incomeBreakdown: IncomeBreakdown;
    expenseBreakdown: ExpenseBreakdown;
    fixedExpenseTemplates: FixedExpenseTemplatesTotals;
    installments: InstallmentTotals;
  };
  categoryDistribution: CategorySlice[];
  monthlyTrend: MonthlyTrendPoint[];
  insights: Insight[];
};

type TrendRow = { month: Date; type: "INCOME" | "EXPENSE"; total: number | string };

/**
 * Resume os parcelamentos de um mês específico. `monthStart` deve ser o primeiro dia do mês em
 * fuso local (ex.: `new Date(2026, 5, 1)` para junho/2026).
 * - `currentMonth` / `currentMonthCount`: soma e contagem das parcelas do mês informado.
 * - `remaining`: soma das parcelas do mês SEGUINTE (label "Continua próx. mês").
 * - `lastInstallmentAmount` / `lastInstallmentPlansCount`: planos cuja última parcela cai neste mês.
 */
export async function getInstallmentsSummary(userId: string, monthStart: Date): Promise<InstallmentTotals> {
  const nextMonthStart = addMonths(monthStart, 1);
  const monthAfterNextStart = addMonths(monthStart, 2);

  const [installmentCurrentMonth, installmentNextMonth, installmentPlans] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, installmentPlanId: { not: null }, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, installmentPlanId: { not: null }, date: { gte: nextMonthStart, lt: monthAfterNextStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.installmentPlan.findMany({
      where: { userId },
      select: {
        totalInstallments: true,
        transactions: { select: { installmentNumber: true, date: true, amount: true } },
      },
    }),
  ]);

  let lastInstallmentPlansCount = 0;
  let lastInstallmentAmount = 0;
  for (const plan of installmentPlans) {
    if (plan.transactions.length === 0) continue;
    const lastTransaction = plan.transactions.find(
      (t) =>
        t.installmentNumber === plan.totalInstallments &&
        t.date >= monthStart &&
        t.date < nextMonthStart
    );
    if (lastTransaction) {
      lastInstallmentPlansCount += 1;
      lastInstallmentAmount += lastTransaction.amount;
    }
  }

  return {
    currentMonth: Number(installmentCurrentMonth._sum.amount ?? 0),
    currentMonthCount: installmentCurrentMonth._count._all,
    remaining: Number(installmentNextMonth._sum.amount ?? 0),
    remainingCount: installmentNextMonth._count._all,
    lastInstallmentPlansCount,
    lastInstallmentAmount,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  return unstable_cache(getDashboardDataUncached, ["dashboard-data", userId], {
    tags: [dashboardCacheTag(userId)],
    revalidate: 60,
  })(userId);
}

export function dashboardCacheTag(userId: string) {
  return `dashboard:${userId}`;
}

async function getDashboardDataUncached(userId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const sixMonthsAgoStart = addMonths(monthStart, -5);

  // Totais e distribuição agregados no banco (groupBy) em vez de trazer as transações do mês
  // inteiras e somar em memória — só o trend de 6 meses precisa de SQL bruto (date_trunc),
  // já que `groupBy` do Prisma não aceita expressões derivadas de coluna.
  const [
    typeTotals,
    categoryTotals,
    trendRows,
    tagRows,
    installmentCurrentMonth,
    installmentNextMonth,
    installmentPlans,
    fixedExpenseChecklist,
  ] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type", "isFixed"],
      where: { userId, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<TrendRow[]>`
      SELECT date_trunc('month', "date") AS month, "type" AS type, SUM("amount") AS total
      FROM "transactions"
      WHERE "userId" = ${userId} AND "date" >= ${sixMonthsAgoStart} AND "date" < ${nextMonthStart}
      GROUP BY date_trunc('month', "date"), "type"
    `,
    prisma.transactionTag.findMany({
      where: { transaction: { userId, type: "EXPENSE", date: { gte: monthStart, lt: nextMonthStart } } },
      select: { transaction: { select: { amount: true } }, tag: { select: { name: true } } },
    }),
    prisma.transaction.aggregate({
      where: { userId, installmentPlanId: { not: null }, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, installmentPlanId: { not: null }, date: { gte: nextMonthStart, lt: addMonths(nextMonthStart, 1) } },
      _count: { _all: true },
    }),
    prisma.installmentPlan.findMany({
      where: { userId },
      select: {
        totalInstallments: true,
        estimatedAmount: true,
        transactions: { select: { installmentNumber: true, date: true, amount: true } },
      },
    }),
    getFixedExpensesChecklist(userId, monthKeyOf(monthStart)),
  ]);

  let income = 0;
  let expense = 0;
  const incomeBreakdown: IncomeBreakdown = { fixedTotal: 0, fixedCount: 0, variableTotal: 0, variableCount: 0 };
  const expenseBreakdown: ExpenseBreakdown = { fixedTotal: 0, fixedCount: 0, variableTotal: 0, variableCount: 0 };
  for (const row of typeTotals) {
    const sum = Number(row._sum.amount ?? 0);
    const count = row._count._all;
    if (row.type === "INCOME") {
      income += sum;
      if (row.isFixed) {
        incomeBreakdown.fixedTotal += sum;
        incomeBreakdown.fixedCount += count;
      } else {
        incomeBreakdown.variableTotal += sum;
        incomeBreakdown.variableCount += count;
      }
    } else {
      expense += sum;
      if (row.isFixed) {
        expenseBreakdown.fixedTotal += sum;
        expenseBreakdown.fixedCount += count;
      } else {
        expenseBreakdown.variableTotal += sum;
        expenseBreakdown.variableCount += count;
      }
    }
  }

  // Breakdown pendente/pago das despesas fixas com base no `FixedExpenseTemplate`, fonte única
  // de verdade para despesas fixas (substitui a antiga soma simples por `Transaction.isFixed`).
  // Pago usa o valor real pago (paidAmount, vindo da Transaction criada), pendente usa o
  // expectedAmount do template.
  let fixedExpenseTemplatesPendingTotal = 0;
  let fixedExpenseTemplatesPaidTotal = 0;
  let fixedExpenseTemplatesPendingCount = 0;
  let fixedExpenseTemplatesPaidCount = 0;
  for (const item of fixedExpenseChecklist) {
    if (item.status === "paid") {
      fixedExpenseTemplatesPaidTotal += item.paidAmount ?? 0;
      fixedExpenseTemplatesPaidCount += 1;
    } else {
      fixedExpenseTemplatesPendingTotal += item.expectedAmount;
      fixedExpenseTemplatesPendingCount += 1;
    }
  }
  const fixedExpenseTemplates: FixedExpenseTemplatesTotals = {
    pendingTotal: fixedExpenseTemplatesPendingTotal,
    paidTotal: fixedExpenseTemplatesPaidTotal,
    pendingCount: fixedExpenseTemplatesPendingCount,
    paidCount: fixedExpenseTemplatesPaidCount,
  };

  // Plano "ativo" é derivado: existe pelo menos uma transação lançada com installmentNumber < totalInstallments.
  // "Falta pagar" = (totalInstallments - maior installmentNumber já lançado) × estimatedAmount, por plano.
  // "Última parcela" = planos cuja última parcela (installmentNumber === totalInstallments) cai no mês atual.
  let installmentsRemaining = 0;
  let lastInstallmentPlansCount = 0;
  let lastInstallmentAmount = 0;
  for (const plan of installmentPlans) {
    if (plan.transactions.length === 0) continue;
    const maxLaunched = Math.max(...plan.transactions.map((t) => t.installmentNumber ?? 0));
    const remainingCount = plan.totalInstallments - maxLaunched;
    if (remainingCount > 0) {
      installmentsRemaining += remainingCount * plan.estimatedAmount;
    }
    const lastTransaction = plan.transactions.find(
      (t) =>
        t.installmentNumber === plan.totalInstallments &&
        t.date >= monthStart &&
        t.date < nextMonthStart
    );
    if (lastTransaction) {
      lastInstallmentPlansCount += 1;
      lastInstallmentAmount += lastTransaction.amount;
    }
  }
  const installments = {
    currentMonth: Number(installmentCurrentMonth._sum.amount ?? 0),
    currentMonthCount: installmentCurrentMonth._count._all,
    remaining: installmentsRemaining,
    remainingCount: installmentNextMonth._count._all,
    lastInstallmentPlansCount,
    lastInstallmentAmount,
  };
  const balance = income - expense;

  const categoryIds = categoryTotals.map((row) => row.categoryId).filter((id): id is string => id !== null);
  const categoryRows =
    categoryIds.length > 0
      ? await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, color: true } })
      : [];
  const categoryById = new Map(categoryRows.map((c) => [c.id, c]));

  const categoryDistribution: CategorySlice[] = categoryTotals
    .map((row) => {
      const meta = row.categoryId ? categoryById.get(row.categoryId) : undefined;
      return {
        id: row.categoryId ?? "sem-grupo",
        name: meta?.name ?? "Sem grupo",
        color: meta?.color ?? "#6B7A72",
        value: Number(row._sum.amount ?? 0),
      };
    })
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);

  const monthBuckets = new Map<string, MonthlyTrendPoint>();
  for (let i = 5; i >= 0; i -= 1) {
    const bucketDate = addMonths(monthStart, -i);
    const key = monthKeyOf(bucketDate);
    monthBuckets.set(key, { key, label: monthLabel(bucketDate), income: 0, expense: 0 });
  }
  for (const row of trendRows) {
    const bucket = monthBuckets.get(monthKeyOf(row.month));
    if (!bucket) continue;
    const total = Number(row.total ?? 0);
    if (row.type === "INCOME") bucket.income += total;
    else bucket.expense += total;
  }
  const monthlyTrend = Array.from(monthBuckets.values());

  const tagTotals = new Map<string, { total: number; count: number }>();
  for (const row of tagRows) {
    const entry = tagTotals.get(row.tag.name) ?? { total: 0, count: 0 };
    entry.total += row.transaction.amount;
    entry.count += 1;
    tagTotals.set(row.tag.name, entry);
  }

  const insights = buildInsights({
    totals: { income, expense, balance },
    fixedExpenseTemplates,
    categoryDistribution,
    monthlyTrend,
    tagTotals,
  });

  return {
    totals: { income, expense, balance, incomeBreakdown, expenseBreakdown, fixedExpenseTemplates, installments },
    categoryDistribution,
    monthlyTrend,
    insights,
  };
}

function buildInsights({
  totals,
  fixedExpenseTemplates,
  categoryDistribution,
  monthlyTrend,
  tagTotals,
}: {
  totals: { income: number; expense: number; balance: number };
  fixedExpenseTemplates: FixedExpenseTemplatesTotals;
  categoryDistribution: CategorySlice[];
  monthlyTrend: MonthlyTrendPoint[];
  tagTotals: Map<string, { total: number; count: number }>;
}): Insight[] {
  const insights: Insight[] = [];

  // 1. Grupo com maior gasto no mês
  if (categoryDistribution.length > 0) {
    const top = categoryDistribution[0];
    const share = totals.expense > 0 ? (top.value / totals.expense) * 100 : 0;
    insights.push({
      id: "top-category",
      tone: "info",
      title: `${top.name} concentra a maior parte dos seus gastos`,
      description: `Esse grupo representa ${share.toFixed(0)}% das suas despesas neste mês, totalizando ${formatBRL(top.value)}.`,
    });
  }

  // 2. Mês com desvio acima da média histórica
  const previousMonths = monthlyTrend.slice(0, -1);
  const currentMonth = monthlyTrend[monthlyTrend.length - 1];
  if (previousMonths.length > 0 && currentMonth) {
    const historicAverage = previousMonths.reduce((sum, m) => sum + m.expense, 0) / previousMonths.length;
    if (historicAverage > 0) {
      const deviation = ((currentMonth.expense - historicAverage) / historicAverage) * 100;
      if (deviation > 15) {
        insights.push({
          id: "deviation-high",
          tone: "warning",
          title: "Seus gastos estão acima da média histórica",
          description: `Você já gastou ${deviation.toFixed(0)}% a mais que a sua média dos últimos meses (${formatBRL(historicAverage)}).`,
        });
      } else if (deviation < -15) {
        insights.push({
          id: "deviation-low",
          tone: "success",
          title: "Você está gastando menos que o seu costume",
          description: `Seus gastos estão ${Math.abs(deviation).toFixed(0)}% abaixo da sua média histórica de ${formatBRL(historicAverage)}. Continue assim!`,
        });
      }
    }
  }

  // 3. Sugestão de economia baseada no maior grupo
  if (categoryDistribution.length > 0 && categoryDistribution[0].value > 0) {
    const top = categoryDistribution[0];
    const suggestedCut = top.value * 0.1;
    insights.push({
      id: "savings-suggestion",
      tone: "info",
      title: `Reduza 10% em ${top.name} e economize ${formatBRL(suggestedCut)}`,
      description: `Cortar uma pequena parte dos gastos com ${top.name} pode liberar ${formatBRL(suggestedCut)} por mês para suas metas.`,
    });
  }

  // 4. Alerta de despesas fixas acima de 50%
  const fixedExpenseTotal = fixedExpenseTemplates.pendingTotal + fixedExpenseTemplates.paidTotal;
  if (totals.expense > 0) {
    const fixedShare = (fixedExpenseTotal / totals.expense) * 100;
    if (fixedShare > 50) {
      insights.push({
        id: "fixed-expenses-alert",
        tone: "warning",
        title: "Despesas fixas ultrapassam metade do seu orçamento",
        description: `${fixedShare.toFixed(0)}% das suas despesas neste mês são fixas (${formatBRL(fixedExpenseTotal)}). Avalie renegociar contratos recorrentes.`,
      });
    }
  }

  // 5. Hashtag que concentra mais gastos
  if (tagTotals.size > 0) {
    const [topTag, topTagValue] = Array.from(tagTotals.entries()).sort((a, b) => b[1].total - a[1].total)[0];
    insights.push({
      id: "top-hashtag",
      tone: "info",
      title: `#${topTag} é a hashtag que mais concentra gastos`,
      description: `Lançamentos marcados com #${topTag} somam ${formatBRL(topTagValue.total)} neste mês.`,
    });
  }

  return insights;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
