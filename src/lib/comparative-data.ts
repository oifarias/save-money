import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";

const NO_CATEGORY_ID = "sem-grupo";
const NO_CATEGORY_COLOR = "#6B7A72";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export type ComparativeMonth = {
  key: string;
  label: string;
};

export type ComparativeCategoryMeta = {
  id: string;
  name: string;
  color: string;
};

export type ComparativeData = {
  months: ComparativeMonth[];
  categories: ComparativeCategoryMeta[];
  /** totals[monthKey][categoryId] */
  totals: Record<string, Record<string, { expense: number; income: number }>>;
};

const MONTHS_WINDOW = 12;

export async function getComparativeData(userId: string): Promise<ComparativeData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const windowStart = addMonths(monthStart, -(MONTHS_WINDOW - 1));

  const transactions = await prisma.transaction.findMany({
    where: { userId, date: { gte: windowStart, lt: nextMonthStart } },
    select: {
      type: true,
      amount: true,
      date: true,
      category: { select: { id: true, name: true, color: true } },
    },
  });

  const months: ComparativeMonth[] = [];
  for (let i = MONTHS_WINDOW - 1; i >= 0; i -= 1) {
    const bucketDate = addMonths(monthStart, -i);
    months.push({ key: monthKey(bucketDate), label: monthLabel(bucketDate) });
  }

  const categoriesById = new Map<string, ComparativeCategoryMeta>();
  const totals: Record<string, Record<string, { expense: number; income: number }>> = {};
  for (const month of months) {
    totals[month.key] = {};
  }

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const bucket = totals[key];
    if (!bucket) continue;

    const categoryId = tx.category?.id ?? NO_CATEGORY_ID;
    if (!categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, {
        id: categoryId,
        name: tx.category?.name ?? "Sem grupo",
        color: tx.category?.color ?? NO_CATEGORY_COLOR,
      });
    }

    if (!bucket[categoryId]) {
      bucket[categoryId] = { expense: 0, income: 0 };
    }
    if (tx.type === "INCOME") bucket[categoryId].income += tx.amount;
    else bucket[categoryId].expense += tx.amount;
  }

  const categories = Array.from(categoriesById.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { months, categories, totals };
}
