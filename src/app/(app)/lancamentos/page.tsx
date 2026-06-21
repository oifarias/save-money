import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { buildTransactionWhere, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-filters";
import { TransactionsManager } from "@/components/transactions/transactions-manager";

type LancamentosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LancamentosPage({ searchParams }: LancamentosPageProps) {
  const session = await auth();
  const userId = session!.user.id;

  const rawSearchParams = await searchParams;
  const filters = parseTransactionFilters(rawSearchParams);
  const where = await buildTransactionWhere(userId, filters);
  const page = filters.page ?? 1;

  const [total, transactions, categories, tags] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * TRANSACTIONS_PAGE_SIZE,
      take: TRANSACTIONS_PAGE_SIZE,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        subcategory: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
    }),
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const items = transactions.map((transaction) => ({
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

  return (
    <TransactionsManager
      transactions={items}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        children: category.children,
      }))}
      tagSuggestions={tags.map((tag) => tag.name)}
      totalCount={total}
      page={page}
      pageSize={TRANSACTIONS_PAGE_SIZE}
    />
  );
}
