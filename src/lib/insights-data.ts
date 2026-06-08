import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";

const NO_CATEGORY_ID = "sem-grupo";
const NO_CATEGORY_COLOR = "#6B7A72";
const HISTORY_WINDOW = 6;
const GROWTH_WINDOW = 3;
const REDUCTION_GOAL_PERCENT = 0.1;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type CategoryMeta = {
  id: string;
  name: string;
  color: string;
};

export type CategoryGrowth = CategoryMeta & {
  pastValue: number;
  currentValue: number;
  growthPercent: number;
};

export type CategoryAverageComparison = CategoryMeta & {
  average: number;
  current: number;
  deltaPercent: number;
};

export type ReductionSuggestion = CategoryMeta & {
  currentSpend: number;
  suggestedCut: number;
  targetSpend: number;
};

export type HashtagRanking = {
  name: string;
  total: number;
  count: number;
};

export type FixedExpenseAlert = {
  fixedTotal: number;
  expenseTotal: number;
  share: number;
};

export type InsightsPageData = {
  windowLabel: string;
  growthWindowLabel: { from: string; to: string };
  categoryGrowth: CategoryGrowth[];
  categoryAverages: CategoryAverageComparison[];
  reductionSuggestions: ReductionSuggestion[];
  hashtagRanking: HashtagRanking[];
  fixedExpenseAlert: FixedExpenseAlert | null;
  hasData: boolean;
};

export async function getInsightsPageData(userId: string): Promise<InsightsPageData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const historyStart = addMonths(monthStart, -(HISTORY_WINDOW - 1));
  const growthStart = addMonths(monthStart, -(GROWTH_WINDOW - 1));

  const transactions = await prisma.transaction.findMany({
    where: { userId, type: "EXPENSE", date: { gte: historyStart, lt: nextMonthStart } },
    select: {
      amount: true,
      date: true,
      isFixed: true,
      category: { select: { id: true, name: true, color: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const categoriesById = new Map<string, CategoryMeta>();
  /** monthKey -> categoryId -> total */
  const monthlyByCategory = new Map<string, Map<string, number>>();
  let currentMonthExpense = 0;
  let currentMonthFixed = 0;
  const currentMonthTagTotals = new Map<string, { total: number; count: number }>();

  for (const tx of transactions) {
    const categoryId = tx.category?.id ?? NO_CATEGORY_ID;
    if (!categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, {
        id: categoryId,
        name: tx.category?.name ?? "Sem grupo",
        color: tx.category?.color ?? NO_CATEGORY_COLOR,
      });
    }

    const key = monthKey(tx.date);
    if (!monthlyByCategory.has(key)) monthlyByCategory.set(key, new Map());
    const bucket = monthlyByCategory.get(key)!;
    bucket.set(categoryId, (bucket.get(categoryId) ?? 0) + tx.amount);

    const isCurrentMonth = tx.date >= monthStart && tx.date < nextMonthStart;
    if (isCurrentMonth) {
      currentMonthExpense += tx.amount;
      if (tx.isFixed) currentMonthFixed += tx.amount;
      for (const { tag } of tx.tags) {
        const entry = currentMonthTagTotals.get(tag.name) ?? { total: 0, count: 0 };
        entry.total += tx.amount;
        entry.count += 1;
        currentMonthTagTotals.set(tag.name, entry);
      }
    }
  }

  const currentKey = monthKey(monthStart);
  const growthPastKey = monthKey(growthStart);

  function categoryTotalAt(key: string, categoryId: string) {
    return monthlyByCategory.get(key)?.get(categoryId) ?? 0;
  }

  // 1. Crescimento de gastos por grupo nos últimos 3 meses
  const categoryGrowth: CategoryGrowth[] = Array.from(categoriesById.values())
    .map((category) => {
      const pastValue = categoryTotalAt(growthPastKey, category.id);
      const currentValue = categoryTotalAt(currentKey, category.id);
      const growthPercent = pastValue > 0 ? ((currentValue - pastValue) / pastValue) * 100 : currentValue > 0 ? 100 : 0;
      return { ...category, pastValue, currentValue, growthPercent };
    })
    .filter((entry) => entry.pastValue > 0 || entry.currentValue > 0)
    .sort((a, b) => b.growthPercent - a.growthPercent)
    .slice(0, 5);

  // 2. Média mensal de cada grupo (histórico) vs mês atual
  const historyKeys = Array.from(monthlyByCategory.keys()).filter((key) => key !== currentKey);
  const categoryAverages: CategoryAverageComparison[] = Array.from(categoriesById.values())
    .map((category) => {
      const historicalTotal = historyKeys.reduce((sum, key) => sum + categoryTotalAt(key, category.id), 0);
      const average = historyKeys.length > 0 ? historicalTotal / historyKeys.length : 0;
      const current = categoryTotalAt(currentKey, category.id);
      const deltaPercent = average > 0 ? ((current - average) / average) * 100 : current > 0 ? 100 : 0;
      return { ...category, average, current, deltaPercent };
    })
    .filter((entry) => entry.average > 0 || entry.current > 0)
    .sort((a, b) => b.current - a.current);

  // 3. Sugestão de metas de redução para os grupos mais pesados do mês atual
  const reductionSuggestions: ReductionSuggestion[] = Array.from(categoriesById.values())
    .map((category) => ({ ...category, currentSpend: categoryTotalAt(currentKey, category.id) }))
    .filter((entry) => entry.currentSpend > 0)
    .sort((a, b) => b.currentSpend - a.currentSpend)
    .slice(0, 3)
    .map((entry) => {
      const suggestedCut = entry.currentSpend * REDUCTION_GOAL_PERCENT;
      return { ...entry, suggestedCut, targetSpend: entry.currentSpend - suggestedCut };
    });

  // 4. Hashtag que concentra mais gastos (ranking do mês atual)
  const hashtagRanking: HashtagRanking[] = Array.from(currentMonthTagTotals.entries())
    .map(([name, value]) => ({ name, total: value.total, count: value.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 5. Alerta de despesas fixas acima de 50%
  const fixedShare = currentMonthExpense > 0 ? (currentMonthFixed / currentMonthExpense) * 100 : 0;
  const fixedExpenseAlert: FixedExpenseAlert | null =
    currentMonthExpense > 0
      ? { fixedTotal: currentMonthFixed, expenseTotal: currentMonthExpense, share: fixedShare }
      : null;

  return {
    windowLabel: `${monthLabel(historyStart)} – ${monthLabel(monthStart)}`,
    growthWindowLabel: { from: monthLabel(growthStart), to: monthLabel(monthStart) },
    categoryGrowth,
    categoryAverages,
    reductionSuggestions,
    hashtagRanking,
    fixedExpenseAlert,
    hasData: transactions.length > 0,
  };
}
