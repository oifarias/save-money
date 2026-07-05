import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionFilters } from "@/lib/validations/transaction-filters";

export const TRANSACTIONS_PAGE_SIZE = 25;

export async function buildTransactionWhere(
  userId: string,
  filters: TransactionFilters,
  options: { defaultPeriod?: "30" | "45" | "60" | "all" } = {}
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

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.isFixed) {
    where.isFixed = filters.isFixed === "true";
  }

  if (filters.installment) {
    where.installmentPlanId = { not: null };
  }

  if (filters.tagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: filters.tagId, userId },
      select: { id: true },
    });
    if (tag) {
      where.tags = { some: { tagId: tag.id } };
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

    // Fuso local, igual ao usado em `dashboard-data.ts` (`startOfMonth`/`addMonths`) — mesmo mês
    // calendário precisa produzir os mesmos limites de data nos dois lugares, senão os totais
    // exibidos no Dashboard e em /lancamentos divergem para o mesmo período.
    if (filters.day) {
      const start = new Date(year, month - 1, filters.day);
      const end = new Date(year, month - 1, filters.day + 1);
      where.date = { gte: start, lt: end };
    } else {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      where.date = { gte: start, lt: end };
    }
  } else {
    const period = filters.period ?? options.defaultPeriod ?? "30";
    if (period !== "all") {
      const days = Number(period);
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
      where.date = { gte: start, lt: end };
    }
  }

  return where;
}

export function getEffectivePeriod(
  filters: Pick<TransactionFilters, "month" | "period">,
  defaultPeriod: "30" | "45" | "60" | "all" = "30"
): "30" | "45" | "60" | "all" | null {
  if (filters.month) return null;
  return filters.period ?? defaultPeriod;
}
