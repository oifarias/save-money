import { prisma } from "@/lib/prisma";
import { buildTransactionWhere, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-filters";
import type { TransactionFilters } from "@/lib/validations/transaction-filters";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

export async function getTransactionsPage(
  userId: string,
  filters: TransactionFilters,
  page: number
): Promise<TransactionListItem[]> {
  const where = await buildTransactionWhere(userId, filters);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
    take: TRANSACTIONS_PAGE_SIZE,
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      subcategory: { select: { id: true, name: true, color: true, icon: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    date: transaction.date.toISOString(),
    description: transaction.description,
    amount: transaction.amount,
    isFixed: transaction.isFixed,
    recurrence: transaction.recurrence,
    category: transaction.category,
    subcategory: transaction.subcategory,
    tags: transaction.tags.map((t) => t.tag.name),
  }));
}
