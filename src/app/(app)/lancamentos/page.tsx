import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { buildTransactionWhere, getEffectivePeriod, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-filters";
import { getTransactionsPage } from "@/lib/transactions-query";
import { TransactionIntake } from "@/components/transactions/transaction-intake";
import { TransactionsManager } from "@/components/transactions/transactions-manager";

type LancamentosPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PERIOD_SUMMARY_LABELS: Record<"30" | "45" | "60" | "all", string> = {
  "30": "nos últimos 30 dias",
  "45": "nos últimos 45 dias",
  "60": "nos últimos 60 dias",
  all: "no período exibido",
};

export default async function LancamentosPage({ searchParams }: LancamentosPageProps) {
  const session = await auth();
  const userId = session!.user.id;

  const rawSearchParams = await searchParams;
  const filters = parseTransactionFilters(rawSearchParams);
  const where = await buildTransactionWhere(userId, filters);
  const effectivePeriod = getEffectivePeriod(filters);
  const periodLabel = effectivePeriod ? PERIOD_SUMMARY_LABELS[effectivePeriod] : "na data selecionada";

  const [total, items, categories, tags, incomeAgg, expenseAgg, fixedExpenseAgg] = await Promise.all([
    prisma.transaction.count({ where }),
    getTransactionsPage(userId, filters, 1),
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: "INCOME" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: "EXPENSE" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { ...where, type: "EXPENSE", isFixed: true }, _sum: { amount: true } }),
  ]);

  const income = incomeAgg._sum.amount ?? 0;
  const expense = expenseAgg._sum.amount ?? 0;
  const fixedExpense = fixedExpenseAgg._sum.amount ?? 0;

  const formCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    children: category.children,
  }));
  const tagSuggestions = tags.map((tag) => tag.name);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Lançamentos</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">Registre e acompanhe suas entradas e despesas</p>
      </div>

      <TransactionIntake categories={formCategories} tagSuggestions={tagSuggestions} />

      <TransactionsManager
        transactions={items}
        categories={formCategories}
        tagSuggestions={tagSuggestions}
        totalCount={total}
        pageSize={TRANSACTIONS_PAGE_SIZE}
        summary={{ income, expense, balance: income - expense, fixedExpense, periodLabel }}
      />
    </div>
  );
}
