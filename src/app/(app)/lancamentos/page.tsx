import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionList, type TransactionListItem } from "@/components/transactions/transaction-list";

export default async function LancamentosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [transactions, accounts, categories, tags] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 100,
      include: {
        account: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, color: true, icon: true } },
        tags: { include: { tag: { select: { name: true } } } },
      },
    }),
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
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
    account: transaction.account,
    category: transaction.category,
    tags: transaction.tags.map((t) => t.tag.name),
  }));

  return (
    <TransactionList
      transactions={items}
      accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      tagSuggestions={tags.map((tag) => tag.name)}
    />
  );
}
