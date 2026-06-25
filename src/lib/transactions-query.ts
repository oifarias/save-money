import { prisma } from "@/lib/prisma";
import { TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-filters";
import type { Prisma } from "@/generated/prisma/client";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

/** Recebe o `where` já resolvido (não os filtros crus) pra não revalidar categoria/sub-categoria de novo a cada página. */
export async function getTransactionsPage(
  where: Prisma.TransactionWhereInput,
  page: number
): Promise<TransactionListItem[]> {
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
    take: TRANSACTIONS_PAGE_SIZE,
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      subcategory: { select: { id: true, name: true, color: true, icon: true } },
      tags: { include: { tag: { select: { name: true } } } },
      installmentPlan: { select: { totalInstallments: true } },
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
    installment:
      transaction.installmentNumber && transaction.installmentPlan
        ? { number: transaction.installmentNumber, total: transaction.installmentPlan.totalInstallments }
        : null,
  }));
}
