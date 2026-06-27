import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { buildTransactionWhere, getEffectivePeriod, TRANSACTIONS_PAGE_SIZE } from "@/lib/transaction-filters";
import { getTransactionsPage } from "@/lib/transactions-query";
import { getFixedExpensesChecklist } from "@/lib/fixed-expenses-data";
import type { FixedExpenseTemplatesTotals, IncomeBreakdown, ExpenseBreakdown } from "@/lib/dashboard-data";
import { TransactionIntake } from "@/components/transactions/transaction-intake";
import { TransactionsManager } from "@/components/transactions/transactions-manager";
import { FixedExpensesChecklist } from "@/components/transactions/fixed-expenses-checklist";

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

  const [total, items, categories, tags, incomeAgg, expenseAgg, incomeBreakdownRows, expenseBreakdownRows, fixedExpensesChecklist] =
    await Promise.all([
      prisma.transaction.count({ where }),
      getTransactionsPage(where, 1),
      prisma.category.findMany({
        where: { userId, parentId: null },
        orderBy: { name: "asc" },
        include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      }),
      prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
      prisma.transaction.aggregate({ where: { ...where, type: "INCOME" }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { ...where, type: "EXPENSE" }, _sum: { amount: true } }),
      prisma.transaction.groupBy({
        by: ["isFixed"],
        where: { ...where, type: "INCOME" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.transaction.groupBy({
        by: ["isFixed"],
        where: { ...where, type: "EXPENSE" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      getFixedExpensesChecklist(userId),
    ]);

  const income = incomeAgg._sum.amount ?? 0;
  const expense = expenseAgg._sum.amount ?? 0;

  const incomeBreakdown: IncomeBreakdown = { fixedTotal: 0, fixedCount: 0, variableTotal: 0, variableCount: 0 };
  for (const row of incomeBreakdownRows) {
    const sum = Number(row._sum.amount ?? 0);
    const count = row._count._all;
    if (row.isFixed) {
      incomeBreakdown.fixedTotal += sum;
      incomeBreakdown.fixedCount += count;
    } else {
      incomeBreakdown.variableTotal += sum;
      incomeBreakdown.variableCount += count;
    }
  }
  const expenseBreakdown: ExpenseBreakdown = { fixedTotal: 0, fixedCount: 0, variableTotal: 0, variableCount: 0 };
  for (const row of expenseBreakdownRows) {
    const sum = Number(row._sum.amount ?? 0);
    const count = row._count._all;
    if (row.isFixed) {
      expenseBreakdown.fixedTotal += sum;
      expenseBreakdown.fixedCount += count;
    } else {
      expenseBreakdown.variableTotal += sum;
      expenseBreakdown.variableCount += count;
    }
  }
  // Breakdown pendente/pago das despesas fixas com base no `FixedExpenseTemplate` — fonte única
  // de verdade para despesas fixas (substitui a antiga soma simples via `Transaction.isFixed`).
  const fixedExpenseTemplates: FixedExpenseTemplatesTotals = fixedExpensesChecklist.reduce(
    (acc, item) => {
      if (item.status === "paid") {
        acc.paidTotal += item.paidAmount ?? 0;
        acc.paidCount += 1;
      } else {
        acc.pendingTotal += item.expectedAmount;
        acc.pendingCount += 1;
      }
      return acc;
    },
    { pendingTotal: 0, paidTotal: 0, pendingCount: 0, paidCount: 0 }
  );

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
        <p className="mt-1 text-sm text-(--color-text-muted)">Registre um lançamento individual ou importe várias linhas de uma planilha</p>
      </div>

      <TransactionIntake categories={formCategories} tagSuggestions={tagSuggestions} />

      <FixedExpensesChecklist items={fixedExpensesChecklist} />

      <TransactionsManager
        transactions={items}
        categories={formCategories}
        tagSuggestions={tagSuggestions}
        totalCount={total}
        pageSize={TRANSACTIONS_PAGE_SIZE}
        summary={{ income, expense, fixedExpenseTemplates, incomeBreakdown, expenseBreakdown, periodLabel }}
      />
    </div>
  );
}
