"use server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type ExplorerFilters = {
  categoryIds: string[];
  subcategoryIds: string[];
  tagIds: string[];
  type: "EXPENSE" | "INCOME" | "BOTH";
  dateFrom: string | null;
  dateTo: string | null;
  period: "30" | "90" | "180" | "365" | "all";
  groupBy: "category" | "month";
  chartType:
    | "bar-vertical"
    | "bar-horizontal"
    | "line"
    | "area"
    | "pie"
    | "donut"
    | "stacked-bar";
  showValues: boolean;
  showLegend: boolean;
};

export type ExplorerSeries = { key: string; name: string; color: string };

export type ExplorerDataPoint = Record<string, string | number>;

export type ExplorerResult = {
  data: ExplorerDataPoint[];
  series: ExplorerSeries[];
  total: number;
  isEmpty: boolean;
};

export async function getExplorerData(
  userId: string,
  filters: ExplorerFilters
): Promise<ExplorerResult> {
  // Build where clause — userId sempre obrigatório
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.type !== "BOTH") {
    where.type = filters.type;
  }

  if (filters.categoryIds.length > 0) {
    where.categoryId = { in: filters.categoryIds };
  }

  // Defesa: os pontos de entrada públicos (visualização compartilhada) reconstroem
  // ExplorerFilters a partir de JSON salvo no banco sem passar pelo Zod schema —
  // visualizações salvas antes deste campo existir não terão subcategoryIds.
  const subcategoryIds = filters.subcategoryIds ?? [];
  if (subcategoryIds.length > 0) {
    where.subcategoryId = { in: subcategoryIds };
  }

  if (filters.tagIds.length > 0) {
    where.tags = { some: { tagId: { in: filters.tagIds } } };
  }

  // Intervalo de datas explícito tem precedência sobre o preset de período
  if (filters.dateFrom && filters.dateTo) {
    where.date = {
      gte: new Date(filters.dateFrom),
      lte: new Date(filters.dateTo + "T23:59:59Z"),
    };
  } else if (filters.period !== "all") {
    const days = Number(filters.period);
    const now = new Date();
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    );
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    where.date = { gte: start, lt: end };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      amount: true,
      type: true,
      date: true,
      categoryId: true,
      category: { select: { id: true, name: true, color: true } },
      subcategoryId: true,
      subcategory: { select: { id: true, name: true, color: true } },
    },
    orderBy: { date: "asc" },
  });

  if (transactions.length === 0) {
    return { data: [], series: [], total: 0, isEmpty: true };
  }

  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  // Paleta de cores padrão para categorias sem cor definida
  const DEFAULT_COLORS = [
    "#1a9e6f",
    "#f0a500",
    "#e84040",
    "#6366f1",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#8b5cf6",
    "#0ea5e9",
    "#84cc16",
  ];

  if (filters.groupBy === "category") {
    // Agrupa por grupo (categoria raiz) — série única com o valor total por bucket.
    // Auto drill-down: quando exatamente um grupo está selecionado, todas as
    // transações compartilham o mesmo categoryId, então agrupar por categoryId
    // resultaria numa única barra — agrupamos por subgrupo (subcategoryId) nesse caso.
    const drillDownToSubcategory = filters.categoryIds.length === 1;

    const buckets = new Map<
      string,
      { name: string; color: string; total: number }
    >();

    for (const t of transactions) {
      const id = drillDownToSubcategory
        ? (t.subcategoryId ?? "sem-subgrupo")
        : (t.categoryId ?? "sem-grupo");
      const name = drillDownToSubcategory
        ? (t.subcategory?.name ?? "Sem subgrupo")
        : (t.category?.name ?? "Sem grupo");
      const color =
        (drillDownToSubcategory ? t.subcategory?.color : t.category?.color) ??
        DEFAULT_COLORS[buckets.size % DEFAULT_COLORS.length]!;
      const existing = buckets.get(id);
      if (existing) {
        existing.total += t.amount;
      } else {
        buckets.set(id, { name, color, total: t.amount });
      }
    }

    const entries = [...buckets.entries()].sort(
      (a, b) => b[1].total - a[1].total
    );
    const data: ExplorerDataPoint[] = entries.map(([, v]) => ({
      label: v.name,
      value: Math.round(v.total * 100) / 100,
      color: v.color,
    }));
    const series: ExplorerSeries[] = [
      { key: "value", name: "Valor", color: "#1a9e6f" },
    ];

    return {
      data,
      series,
      total: Math.round(total * 100) / 100,
      isEmpty: false,
    };
  }

  // groupBy === "month"
  // Com filtro de categorias: múltiplas séries (uma por categoria)
  // Sem filtro: série única (total por mês)

  const monthKeys = new Map<string, string>(); // "2026-01" → "jan/26"

  function toMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function toMonthLabel(key: string): string {
    const [y, m] = key.split("-");
    const months = [
      "jan",
      "fev",
      "mar",
      "abr",
      "mai",
      "jun",
      "jul",
      "ago",
      "set",
      "out",
      "nov",
      "dez",
    ];
    return `${months[Number(m) - 1]}/${String(y).slice(2)}`;
  }

  if (filters.categoryIds.length > 0) {
    // Multi-série: categoria × mês
    const categories = new Map<
      string,
      { name: string; color: string; colorIdx: number }
    >();
    const monthData = new Map<string, Record<string, number>>();

    let colorIdx = 0;
    for (const t of transactions) {
      const catId = t.categoryId ?? "sem-grupo";
      const catName = t.category?.name ?? "Sem grupo";
      const catColor =
        t.category?.color ?? DEFAULT_COLORS[colorIdx % DEFAULT_COLORS.length]!;

      if (!categories.has(catId)) {
        categories.set(catId, { name: catName, color: catColor, colorIdx });
        colorIdx++;
      }

      const mKey = toMonthKey(t.date);
      if (!monthKeys.has(mKey)) monthKeys.set(mKey, toMonthLabel(mKey));
      if (!monthData.has(mKey)) monthData.set(mKey, {});
      const row = monthData.get(mKey)!;
      row[catName] = (row[catName] ?? 0) + t.amount;
    }

    const sortedMonths = [...monthData.keys()].sort();
    const data: ExplorerDataPoint[] = sortedMonths.map((mKey) => {
      const row = monthData.get(mKey)!;
      const point: ExplorerDataPoint = { label: monthKeys.get(mKey)! };
      for (const [, cat] of categories) {
        point[cat.name] = Math.round((row[cat.name] ?? 0) * 100) / 100;
      }
      return point;
    });

    const series: ExplorerSeries[] = [...categories.values()].map((cat) => ({
      key: cat.name,
      name: cat.name,
      color: cat.color,
    }));

    return {
      data,
      series,
      total: Math.round(total * 100) / 100,
      isEmpty: false,
    };
  } else {
    // Série única: total por mês
    const monthData = new Map<string, number>();
    for (const t of transactions) {
      const mKey = toMonthKey(t.date);
      if (!monthKeys.has(mKey)) monthKeys.set(mKey, toMonthLabel(mKey));
      monthData.set(mKey, (monthData.get(mKey) ?? 0) + t.amount);
    }

    const sortedMonths = [...monthData.keys()].sort();
    const data: ExplorerDataPoint[] = sortedMonths.map((mKey) => ({
      label: monthKeys.get(mKey)!,
      value: Math.round((monthData.get(mKey) ?? 0) * 100) / 100,
    }));
    const series: ExplorerSeries[] = [
      { key: "value", name: "Total", color: "#1a9e6f" },
    ];

    return {
      data,
      series,
      total: Math.round(total * 100) / 100,
      isEmpty: false,
    };
  }
}
