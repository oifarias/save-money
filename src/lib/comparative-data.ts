import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";
import { buildTransactionWhere } from "@/lib/transaction-filters";
import type { TransactionFilters } from "@/lib/validations/transaction-filters";
import type { Prisma } from "@/generated/prisma/client";

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

export type SubcategoryBreakdownItem = { name: string; expense: number; income: number };

export type ComparativeData = {
  months: ComparativeMonth[];
  categories: ComparativeCategoryMeta[];
  /** totals[monthKey][categoryId] */
  totals: Record<string, Record<string, { expense: number; income: number }>>;
  /** subcategoryBreakdown[monthKey][categoryId][subcategoryId | "__other__"] */
  subcategoryBreakdown: Record<string, Record<string, Record<string, SubcategoryBreakdownItem>>>;
};

const MONTHS_WINDOW = 12;

export async function getComparativeData(userId: string, filters: TransactionFilters = {}): Promise<ComparativeData> {
  return unstable_cache(getComparativeDataUncached, ["comparative-data", userId], {
    tags: [comparativeCacheTag(userId)],
    revalidate: 60,
  })(userId, filters);
}

export function comparativeCacheTag(userId: string) {
  return `comparative:${userId}`;
}

async function getComparativeDataUncached(userId: string, filters: TransactionFilters = {}): Promise<ComparativeData> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const windowStart = addMonths(monthStart, -(MONTHS_WINDOW - 1));

  // Filtros de grupo/sub-grupo/descrição/valor/data, com período padrão "todo o período" (em vez dos
  // últimos 30 dias usados em /lancamentos), já que aqui a janela natural é de 12 meses.
  const filterWhere = await buildTransactionWhere(userId, filters, { defaultPeriod: "all" });
  const filterDate = filterWhere.date as { gte?: Date; lt?: Date } | undefined;

  const gte = filterDate?.gte && filterDate.gte > windowStart ? filterDate.gte : windowStart;
  const lt = filterDate?.lt && filterDate.lt < nextMonthStart ? filterDate.lt : nextMonthStart;

  const where: Prisma.TransactionWhereInput = { ...filterWhere, date: { gte, lt } };

  const transactions = await prisma.transaction.findMany({
    where,
    select: {
      type: true,
      amount: true,
      date: true,
      category: { select: { id: true, name: true, color: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });

  const months: ComparativeMonth[] = [];
  for (let i = MONTHS_WINDOW - 1; i >= 0; i -= 1) {
    const bucketDate = addMonths(monthStart, -i);
    months.push({ key: monthKey(bucketDate), label: monthLabel(bucketDate) });
  }

  const categoriesById = new Map<string, ComparativeCategoryMeta>();
  const totals: Record<string, Record<string, { expense: number; income: number }>> = {};
  const subcategoryBreakdown: Record<string, Record<string, Record<string, SubcategoryBreakdownItem>>> = {};
  for (const month of months) {
    totals[month.key] = {};
    subcategoryBreakdown[month.key] = {};
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

    const subBucket = subcategoryBreakdown[key];
    if (subBucket) {
      if (!subBucket[categoryId]) subBucket[categoryId] = {};
      const subId = tx.subcategory?.id ?? "__other__";
      const subName = tx.subcategory?.name ?? "(sem sub-grupo)";
      if (!subBucket[categoryId][subId]) {
        subBucket[categoryId][subId] = { name: subName, expense: 0, income: 0 };
      }
      if (tx.type === "INCOME") subBucket[categoryId][subId].income += tx.amount;
      else subBucket[categoryId][subId].expense += tx.amount;
    }
  }

  const categories = Array.from(categoriesById.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return { months, categories, totals, subcategoryBreakdown };
}
