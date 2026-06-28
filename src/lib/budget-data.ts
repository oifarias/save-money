import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";
import type { Bucket } from "@/lib/budget-buckets";

export type { Bucket } from "@/lib/budget-buckets";
export { getDefaultBucket } from "@/lib/budget-buckets";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthKeyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey() {
  return monthKeyOf(new Date());
}

export function previousMonthKeyOf(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return monthKeyOf(new Date(year, month - 2, 1));
}

export type IncomeMonthBreakdown = { key: string; label: string; amount: number };

export type IncomeBaseline = {
  amount: number;
  source: "average_3_months" | "manual" | "copied_previous_month";
  monthlyBreakdown: IncomeMonthBreakdown[] | null;
  isSaved: boolean;
};

/**
 * Renda de referência pra tela de metas: se já existe um valor salvo pro mês, usa ele.
 * Senão, calcula a média das entradas dos últimos 3 meses corridos — só se os 3 tiverem
 * pelo menos um lançamento de entrada; caso contrário retorna null (jornada cai pro input manual).
 */
export async function getIncomeBaseline(userId: string, monthKey: string): Promise<IncomeBaseline | null> {
  const saved = await prisma.budgetIncome.findUnique({ where: { userId_month: { userId, month: monthKey } } });
  if (saved) {
    return {
      amount: saved.amount,
      source: saved.source as IncomeBaseline["source"],
      monthlyBreakdown: null,
      isSaved: true,
    };
  }

  const monthStart = startOfMonth(new Date());
  const pastMonths = [3, 2, 1].map((i) => addMonths(monthStart, -i));
  const earliestStart = pastMonths[0];

  const incomeTransactions = await prisma.transaction.findMany({
    where: { userId, type: "INCOME", date: { gte: earliestStart, lt: monthStart } },
    select: { amount: true, date: true },
  });

  const sumsByMonth = new Map<string, number>();
  for (const tx of incomeTransactions) {
    const key = monthKeyOf(tx.date);
    sumsByMonth.set(key, (sumsByMonth.get(key) ?? 0) + tx.amount);
  }

  const monthlyBreakdown: IncomeMonthBreakdown[] = pastMonths.map((date) => ({
    key: monthKeyOf(date),
    label: monthLabel(date),
    amount: sumsByMonth.get(monthKeyOf(date)) ?? 0,
  }));

  const hasThreeFullMonths = monthlyBreakdown.every((m) => m.amount > 0);
  if (!hasThreeFullMonths) return null;

  const average = monthlyBreakdown.reduce((sum, m) => sum + m.amount, 0) / monthlyBreakdown.length;
  return { amount: average, source: "average_3_months", monthlyBreakdown, isSaved: false };
}

/** Média de gasto mensal por categoria, considerando só os meses (fechados) em que houve gasto naquela categoria. */
export async function getCategoryHistoricalAverages(userId: string, monthsWindow = 6): Promise<Map<string, number>> {
  const monthStart = startOfMonth(new Date());
  const historyStart = addMonths(monthStart, -monthsWindow);

  const [sumRows, monthCountRows] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        type: "EXPENSE",
        categoryId: { not: null },
        date: { gte: historyStart, lt: monthStart },
      },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<{ categoryId: string; month_count: bigint }[]>`
      SELECT "categoryId", COUNT(DISTINCT TO_CHAR(date, 'YYYY-MM')) AS month_count
      FROM "transactions"
      WHERE "userId" = ${userId}
        AND type = 'EXPENSE'
        AND "categoryId" IS NOT NULL
        AND date >= ${historyStart}
        AND date < ${monthStart}
      GROUP BY "categoryId"
    `,
  ]);

  const monthCountByCategoryId = new Map(
    monthCountRows.map((r) => [r.categoryId, Number(r.month_count)])
  );

  const averages = new Map<string, number>();
  for (const row of sumRows) {
    const categoryId = row.categoryId as string;
    const total = row._sum.amount ?? 0;
    const monthsWithSpend = monthCountByCategoryId.get(categoryId) ?? 1;
    averages.set(categoryId, total / monthsWithSpend);
  }
  return averages;
}

export type BudgetCategoryProgress = {
  categoryId: string;
  name: string;
  color: string;
  icon: string;
  bucket: Bucket;
  limitAmount: number;
  spent: number;
  committed: number;
};

export type BudgetProgress = {
  month: string;
  income: number;
  necessidade: { limit: number; spent: number; committed: number };
  desejo: { limit: number; spent: number; committed: number };
  savingsTarget: number;
  savingsActual: number;
  categories: BudgetCategoryProgress[];
};

function diffInMonths(monthKey: string, startDate: Date) {
  const [year, month] = monthKey.split("-").map(Number);
  return (year - startDate.getFullYear()) * 12 + (month - 1 - startDate.getMonth());
}

/**
 * Busca os InstallmentPlans UMA vez e calcula o comprometido por categoria para múltiplos meses
 * em memória — elimina N queries quando chamada para um horizonte de meses.
 */
export async function getInstallmentCommitmentsByCategoryBatch(
  userId: string,
  monthKeys: string[]
): Promise<Map<string, Map<string, number>>> {
  const plans = await prisma.installmentPlan.findMany({
    where: { userId, categoryId: { not: null } },
    select: {
      categoryId: true,
      totalInstallments: true,
      estimatedAmount: true,
      startDate: true,
      transactions: { select: { installmentNumber: true, date: true } },
    },
  });

  const result = new Map<string, Map<string, number>>();
  for (const monthKey of monthKeys) {
    const [year, month] = monthKey.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const nextMonthStart = new Date(year, month, 1);
    const committedByCategory = new Map<string, number>();

    for (const plan of plans) {
      const categoryId = plan.categoryId as string;
      const projectedInstallmentNumber = diffInMonths(monthKey, plan.startDate) + 1;
      if (projectedInstallmentNumber < 1 || projectedInstallmentNumber > plan.totalInstallments) continue;

      const alreadyLaunchedThisMonth = plan.transactions.some(
        (t) => t.installmentNumber === projectedInstallmentNumber && t.date >= monthStart && t.date < nextMonthStart
      );
      if (alreadyLaunchedThisMonth) continue;

      committedByCategory.set(categoryId, (committedByCategory.get(categoryId) ?? 0) + plan.estimatedAmount);
    }
    result.set(monthKey, committedByCategory);
  }
  return result;
}

/**
 * Calcula, para o mês `monthKey`, o valor comprometido por categoria a partir de `InstallmentPlan`s
 * ativos com `categoryId` definido. Delega à versão batch para reuso de lógica.
 * Planos com `categoryId = null` não participam.
 */
export async function getInstallmentCommitmentsByCategory(userId: string, monthKey: string): Promise<Map<string, number>> {
  const map = await getInstallmentCommitmentsByCategoryBatch(userId, [monthKey]);
  return map.get(monthKey) ?? new Map();
}

/** Retorna null quando o usuário ainda não definiu metas para esse mês (chamador decide mostrar o wizard). */
export async function getBudgetProgress(userId: string, monthKey: string): Promise<BudgetProgress | null> {
  const budgets = await prisma.budget.findMany({
    where: { userId, month: monthKey },
    include: { category: { select: { id: true, name: true, color: true, icon: true } } },
  });
  if (budgets.length === 0) return null;

  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const nextMonthStart = new Date(year, month, 1);
  const categoryIds = budgets.map((b) => b.categoryId);

  const [spentRows, incomeRow, committedByCategory] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { userId, type: "EXPENSE", categoryId: { in: categoryIds }, date: { gte: monthStart, lt: nextMonthStart } },
      _sum: { amount: true },
    }),
    prisma.budgetIncome.findUnique({ where: { userId_month: { userId, month: monthKey } } }),
    getInstallmentCommitmentsByCategoryBatch(userId, [monthKey]).then(m => m.get(monthKey) ?? new Map<string, number>()),
  ]);

  const spentByCategory = new Map(spentRows.map((row) => [row.categoryId as string, row._sum.amount ?? 0]));
  const income = incomeRow?.amount ?? 0;

  const categories: BudgetCategoryProgress[] = budgets
    .map((b) => ({
      categoryId: b.categoryId,
      name: b.category.name,
      color: b.category.color,
      icon: b.category.icon,
      bucket: (b.bucket as Bucket) ?? "desejo",
      limitAmount: b.limitAmount,
      spent: spentByCategory.get(b.categoryId) ?? 0,
      committed: committedByCategory.get(b.categoryId) ?? 0,
    }))
    .sort((a, b) => b.limitAmount - a.limitAmount);

  function sumBucket(bucket: Bucket) {
    return categories
      .filter((c) => c.bucket === bucket)
      .reduce(
        (acc, c) => ({ limit: acc.limit + c.limitAmount, spent: acc.spent + c.spent, committed: acc.committed + c.committed }),
        { limit: 0, spent: 0, committed: 0 }
      );
  }

  const necessidade = sumBucket("necessidade");
  const desejo = sumBucket("desejo");

  return {
    month: monthKey,
    income,
    necessidade,
    desejo,
    savingsTarget: income * 0.2,
    savingsActual: income - necessidade.spent - desejo.spent,
    categories,
  };
}

/**
 * Ao virar o mês, copia os valores do mês anterior como ponto de partida (sem perguntar de novo ao
 * usuário) — só quando já existe histórico de metas; caso contrário, segue pro wizard normalmente.
 */
export async function ensureCurrentMonthBudgets(userId: string, monthKey: string): Promise<void> {
  const existingCount = await prisma.budget.count({ where: { userId, month: monthKey } });
  if (existingCount > 0) return;

  const previousMonthKey = previousMonthKeyOf(monthKey);
  const previousBudgets = await prisma.budget.findMany({ where: { userId, month: previousMonthKey } });
  if (previousBudgets.length === 0) return;

  await prisma.budget.createMany({
    data: previousBudgets.map((b) => ({
      userId,
      categoryId: b.categoryId,
      month: monthKey,
      limitAmount: b.limitAmount,
      bucket: b.bucket,
    })),
  });

  const previousIncome = await prisma.budgetIncome.findUnique({ where: { userId_month: { userId, month: previousMonthKey } } });
  if (previousIncome) {
    await prisma.budgetIncome.upsert({
      where: { userId_month: { userId, month: monthKey } },
      create: { userId, month: monthKey, amount: previousIncome.amount, source: "copied_previous_month" },
      update: {},
    });
  }
}
