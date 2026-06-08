import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboardData } from "@/lib/dashboard-data";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { TransactionList, type TransactionListItem } from "@/components/transactions/transaction-list";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [dashboardData, recentTransactions, accounts, categories, tags] = await Promise.all([
    getDashboardData(userId),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 10,
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

  const feedItems: TransactionListItem[] = recentTransactions.map((transaction) => ({
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Dashboard</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Visão geral das suas finanças no mês atual
        </p>
      </div>

      <SummaryCards
        income={dashboardData.totals.income}
        expense={dashboardData.totals.expense}
        balance={dashboardData.totals.balance}
        fixedExpense={dashboardData.totals.fixedExpense}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryDonutChart data={dashboardData.categoryDistribution} />
        <MonthlyTrendChart data={dashboardData.monthlyTrend} />
      </div>

      <InsightsPanel insights={dashboardData.insights} />

      <TransactionList
        transactions={feedItems}
        accounts={accounts.map((account) => ({ id: account.id, name: account.name }))}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
        tagSuggestions={tags.map((tag) => tag.name)}
        title="Lançamentos recentes"
        description="Os 10 lançamentos mais recentes da sua conta"
        viewAllHref="/lancamentos"
        showHeaderAction={false}
      />
    </div>
  );
}
