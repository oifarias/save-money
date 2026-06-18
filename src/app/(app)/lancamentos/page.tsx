import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionList, type TransactionListItem } from "@/components/transactions/transaction-list";

export default async function LancamentosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [transactions, categories, tags] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
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

  const items: TransactionListItem[] = transactions.map((transaction) => ({
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
    <TransactionList
      transactions={items}
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        children: category.children,
      }))}
      tagSuggestions={tags.map((tag) => tag.name)}
    />
  );
}
