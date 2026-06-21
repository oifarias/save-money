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

export type FixedExpenseCandidate = {
  groupKey: string;
  descriptions: string[];
  amount: number | null;
  monthsCount: number;
  dayOfMonthRange: { min: number; max: number };
  transactions: { id: string; date: string; amount: number }[];
};

export type FixedExpenseResolvedInsight = {
  groupKey: string;
  descriptions: string[];
  amount: number | null;
  categoryName: string | null;
  subcategoryName: string | null;
  transactions: { id: string; date: string; amount: number }[];
  decidedAt: string;
};

export type InsightsPageData = {
  windowLabel: string;
  growthWindowLabel: { from: string; to: string };
  categoryGrowth: CategoryGrowth[];
  categoryAverages: CategoryAverageComparison[];
  reductionSuggestions: ReductionSuggestion[];
  hashtagRanking: HashtagRanking[];
  fixedExpenseAlert: FixedExpenseAlert | null;
  fixedExpenseCandidates: FixedExpenseCandidate[];
  fixedExpenseResolvedInsights: FixedExpenseResolvedInsight[];
  hasData: boolean;
};

export async function getInsightsPageData(userId: string): Promise<InsightsPageData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const historyStart = addMonths(monthStart, -(HISTORY_WINDOW - 1));
  const growthStart = addMonths(monthStart, -(GROWTH_WINDOW - 1));

  const [transactions, decisions] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, type: "EXPENSE", date: { gte: historyStart, lt: nextMonthStart } },
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        isFixed: true,
        category: { select: { id: true, name: true, color: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    }),
    prisma.fixedExpenseInsightDecision.findMany({ where: { userId } }),
  ]);

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

  // 6. Candidatos a despesa fixa: lançamentos ainda não marcados como fixos que se repetem mês a mês,
  // excluindo qualquer grupo que o usuário já aceitou ou descartou anteriormente (decisão permanente por groupKey).
  const decidedGroupKeys = new Set(decisions.map((d) => d.groupKey));
  const fixedExpenseCandidates = detectFixedExpenseCandidates(
    transactions.filter((tx) => !tx.isFixed).map((tx) => ({ id: tx.id, description: tx.description, amount: tx.amount, date: tx.date })),
    decidedGroupKeys
  );

  // 7. Insights já resolvidos (aceitos): descrição/valor/categoria vêm do snapshot salvo na decisão;
  // data/valor por lançamento são buscados de novo (mais confiável que confiar só no snapshot).
  const acceptedDecisions = decisions.filter((d) => d.status === "accepted");
  const categoryIds = Array.from(
    new Set(acceptedDecisions.flatMap((d) => [d.categoryId, d.subcategoryId]).filter((id): id is string => Boolean(id)))
  );
  const allResolvedTransactionIds = Array.from(new Set(acceptedDecisions.flatMap((d) => d.transactionIds)));

  const [categoryRows, resolvedTransactionRows] = await Promise.all([
    categoryIds.length > 0
      ? prisma.category.findMany({ where: { id: { in: categoryIds }, userId }, select: { id: true, name: true } })
      : Promise.resolve([]),
    allResolvedTransactionIds.length > 0
      ? prisma.transaction.findMany({
          where: { id: { in: allResolvedTransactionIds }, userId },
          select: { id: true, date: true, amount: true },
        })
      : Promise.resolve([]),
  ]);

  const categoryNamesById = new Map(categoryRows.map((c) => [c.id, c.name]));
  const resolvedTransactionsById = new Map(resolvedTransactionRows.map((tx) => [tx.id, tx]));

  const fixedExpenseResolvedInsights: FixedExpenseResolvedInsight[] = acceptedDecisions
    .map((d) => ({
      groupKey: d.groupKey,
      descriptions: [d.description],
      amount: d.amount,
      categoryName: d.categoryId ? categoryNamesById.get(d.categoryId) ?? null : null,
      subcategoryName: d.subcategoryId ? categoryNamesById.get(d.subcategoryId) ?? null : null,
      transactions: d.transactionIds
        .map((id) => resolvedTransactionsById.get(id))
        .filter((tx): tx is { id: string; date: Date; amount: number } => Boolean(tx))
        .map((tx) => ({ id: tx.id, date: tx.date.toISOString(), amount: tx.amount })),
      decidedAt: d.createdAt.toISOString(),
    }))
    .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));

  return {
    windowLabel: `${monthLabel(historyStart)} – ${monthLabel(monthStart)}`,
    growthWindowLabel: { from: monthLabel(growthStart), to: monthLabel(monthStart) },
    categoryGrowth,
    categoryAverages,
    reductionSuggestions,
    hashtagRanking,
    fixedExpenseAlert,
    fixedExpenseCandidates,
    fixedExpenseResolvedInsights,
    hasData: transactions.length > 0,
  };
}

type CandidateTx = { id: string; description: string; amount: number; date: Date };

function normalizeDescription(value: string) {
  return value.trim().toLowerCase();
}

function dayOfMonthRangeOf(txs: CandidateTx[]): { min: number; max: number } {
  const days = txs.map((tx) => tx.date.getDate());
  return { min: Math.min(...days), max: Math.max(...days) };
}

function toCandidate(txs: CandidateTx[], groupKey: string, amount: number | null): FixedExpenseCandidate {
  const sorted = [...txs].sort((a, b) => a.date.getTime() - b.date.getTime());
  const descriptions = Array.from(new Set(sorted.map((tx) => tx.description)));
  return {
    groupKey,
    descriptions,
    amount,
    monthsCount: new Set(sorted.map((tx) => monthKey(tx.date))).size,
    dayOfMonthRange: dayOfMonthRangeOf(sorted),
    transactions: sorted.map((tx) => ({ id: tx.id, date: tx.date.toISOString(), amount: tx.amount })),
  };
}

const MAX_FIXED_EXPENSE_CANDIDATES = 8;

/**
 * Chave estável do grupo (sobrevive a recálculos): liga um candidato recorrente
 * a uma decisão (aceita/descartada) já tomada pelo usuário no passado.
 */
function buildGroupKey(kind: "alta" | "possivel-desc" | "possivel-amount", value: string) {
  return `${kind}::${value}`;
}

function detectFixedExpenseCandidates(nonFixedExpenses: CandidateTx[], decidedGroupKeys: Set<string>): FixedExpenseCandidate[] {
  const claimedIds = new Set<string>();
  const candidates: FixedExpenseCandidate[] = [];

  // Alta confiança: mesma descrição normalizada + mesmo valor, recorrente em ≥2 meses distintos.
  const exactGroups = new Map<string, CandidateTx[]>();
  for (const tx of nonFixedExpenses) {
    const key = `${normalizeDescription(tx.description)}::${tx.amount}`;
    const list = exactGroups.get(key) ?? [];
    list.push(tx);
    exactGroups.set(key, list);
  }
  for (const [rawKey, txs] of exactGroups) {
    const groupKey = buildGroupKey("alta", rawKey);
    const monthsCount = new Set(txs.map((tx) => monthKey(tx.date))).size;
    if (txs.length < 2 || monthsCount < 2 || decidedGroupKeys.has(groupKey)) continue;
    txs.forEach((tx) => claimedIds.add(tx.id));
    candidates.push(toCandidate(txs, groupKey, txs[0].amount));
  }

  // Possível: mesma descrição OU mesmo valor isoladamente, só considerando o que não entrou acima.
  const remaining = nonFixedExpenses.filter((tx) => !claimedIds.has(tx.id));

  const descriptionGroups = new Map<string, CandidateTx[]>();
  const amountGroups = new Map<number, CandidateTx[]>();
  for (const tx of remaining) {
    const dKey = normalizeDescription(tx.description);
    descriptionGroups.set(dKey, [...(descriptionGroups.get(dKey) ?? []), tx]);
    amountGroups.set(tx.amount, [...(amountGroups.get(tx.amount) ?? []), tx]);
  }

  function pushPossibleGroup(group: CandidateTx[], groupKey: string, amount: number | null) {
    if (decidedGroupKeys.has(groupKey)) return;
    const freshTxs = group.filter((tx) => !claimedIds.has(tx.id));
    const monthsCount = new Set(freshTxs.map((tx) => monthKey(tx.date))).size;
    if (freshTxs.length < 2 || monthsCount < 2) return;
    freshTxs.forEach((tx) => claimedIds.add(tx.id));
    candidates.push(toCandidate(freshTxs, groupKey, amount));
  }

  for (const [descKey, group] of descriptionGroups) {
    if (group.length >= 2) pushPossibleGroup(group, buildGroupKey("possivel-desc", descKey), null);
  }
  for (const [amount, group] of amountGroups) {
    if (group.length >= 2) pushPossibleGroup(group, buildGroupKey("possivel-amount", String(amount)), amount);
  }

  return candidates.sort((a, b) => b.monthsCount - a.monthsCount).slice(0, MAX_FIXED_EXPENSE_CANDIDATES);
}
