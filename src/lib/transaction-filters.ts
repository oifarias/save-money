import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionFilters } from "@/lib/validations/transaction-filters";

export const TRANSACTIONS_PAGE_SIZE = 25;

export async function buildTransactionWhere(
  userId: string,
  filters: TransactionFilters
): Promise<Prisma.TransactionWhereInput> {
  const where: Prisma.TransactionWhereInput = { userId };

  if (filters.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: filters.categoryId, userId, parentId: null },
      select: { id: true },
    });
    if (category) {
      where.categoryId = category.id;
    }
  }

  if (filters.subcategoryId) {
    const subcategory = await prisma.category.findFirst({
      where: { id: filters.subcategoryId, userId, parentId: { not: null } },
      select: { id: true },
    });
    if (subcategory) {
      where.subcategoryId = subcategory.id;
    }
  }

  if (filters.description) {
    where.description = { contains: filters.description, mode: "insensitive" };
  }

  if (filters.amountOperator && typeof filters.amountValue === "number") {
    if (filters.amountOperator === "eq") {
      where.amount = filters.amountValue;
    } else if (filters.amountOperator === "gt") {
      where.amount = { gt: filters.amountValue };
    } else if (filters.amountOperator === "lt") {
      where.amount = { lt: filters.amountValue };
    }
  }

  if (filters.month) {
    const [yearStr, monthStr] = filters.month.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    if (filters.day) {
      const start = new Date(Date.UTC(year, month - 1, filters.day));
      const end = new Date(Date.UTC(year, month - 1, filters.day + 1));
      where.date = { gte: start, lt: end };
    } else {
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      where.date = { gte: start, lt: end };
    }
  }

  return where;
}
