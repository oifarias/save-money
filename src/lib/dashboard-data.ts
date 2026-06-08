import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
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

export type DashboardData = {
  totals: {
    income: number;
    expense: number;
    balance: number;
    fixedExpense: number;
  };
  categoryDistribution: CategorySlice[];
  monthlyTrend: MonthlyTrendPoint[];
  insights: Insight[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const sixMonthsAgoStart = addMonths(monthStart, -5);

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: sixMonthsAgoStart, lt: nextMonthStart } },
    select: {
      type: true,
      amount: true,
      date: true,
      isFixed: true,
      category: { select: { id: true, name: true, color: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const currentMonthTx = transactions.filter((tx) => tx.date >= monthStart && tx.date < nextMonthStart);

  const totals = currentMonthTx.reduce(
    (acc, tx) => {
      if (tx.type === "INCOME") {
        acc.income += tx.amount;
      } else {
        acc.expense += tx.amount;
        if (tx.isFixed) acc.fixedExpense += tx.amount;
      }
      return acc;
    },
    { income: 0, expense: 0, fixedExpense: 0 }
  );

  const balance = totals.income - totals.expense;

  // Distribuição por categoria (despesas do mês atual)
  const categoryMap = new Map<string, CategorySlice>();
  for (const tx of currentMonthTx) {
    if (tx.type !== "EXPENSE") continue;
    const key = tx.category?.id ?? "sem-grupo";
    const existing = categoryMap.get(key);
    if (existing) {
      existing.value += tx.amount;
    } else {
      categoryMap.set(key, {
        id: key,
        name: tx.category?.name ?? "Sem grupo",
        color: tx.category?.color ?? "#6B7A72",
        value: tx.amount,
      });
    }
  }
  const categoryDistribution = Array.from(categoryMap.values()).sort((a, b) => b.value - a.value);

  // Evolução dos últimos 6 meses
  const monthBuckets = new Map<string, MonthlyTrendPoint>();
  for (let i = 5; i >= 0; i -= 1) {
    const bucketDate = addMonths(monthStart, -i);
    const key = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, { key, label: monthLabel(bucketDate), income: 0, expense: 0 });
  }
  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;
    if (tx.type === "INCOME") bucket.income += tx.amount;
    else bucket.expense += tx.amount;
  }
  const monthlyTrend = Array.from(monthBuckets.values());

  const insights = buildInsights({
    totals: { ...totals, balance },
    categoryDistribution,
    monthlyTrend,
    currentMonthTx,
  });

  return {
    totals: { ...totals, balance },
    categoryDistribution,
    monthlyTrend,
    insights,
  };
}

function buildInsights({
  totals,
  categoryDistribution,
  monthlyTrend,
  currentMonthTx,
}: {
  totals: { income: number; expense: number; balance: number; fixedExpense: number };
  categoryDistribution: CategorySlice[];
  monthlyTrend: MonthlyTrendPoint[];
  currentMonthTx: { type: string; amount: number; tags: { tag: { name: string } }[] }[];
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
  if (totals.expense > 0) {
    const fixedShare = (totals.fixedExpense / totals.expense) * 100;
    if (fixedShare > 50) {
      insights.push({
        id: "fixed-expenses-alert",
        tone: "warning",
        title: "Despesas fixas ultrapassam metade do seu orçamento",
        description: `${fixedShare.toFixed(0)}% das suas despesas neste mês são fixas (${formatBRL(totals.fixedExpense)}). Avalie renegociar contratos recorrentes.`,
      });
    }
  }

  // 5. Hashtag que concentra mais gastos
  const tagTotals = new Map<string, number>();
  for (const tx of currentMonthTx) {
    if (tx.type !== "EXPENSE") continue;
    for (const { tag } of tx.tags) {
      tagTotals.set(tag.name, (tagTotals.get(tag.name) ?? 0) + tx.amount);
    }
  }
  if (tagTotals.size > 0) {
    const [topTag, topTagValue] = Array.from(tagTotals.entries()).sort((a, b) => b[1] - a[1])[0];
    insights.push({
      id: "top-hashtag",
      tone: "info",
      title: `#${topTag} é a hashtag que mais concentra gastos`,
      description: `Lançamentos marcados com #${topTag} somam ${formatBRL(topTagValue)} neste mês.`,
    });
  }

  return insights;
}

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
