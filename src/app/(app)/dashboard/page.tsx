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

  console.log("[dashboard] userId:", userId);

  let queryResult;
  try {
    queryResult = await Promise.all([
      getDashboardData(userId),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 10,
        include: {
          category: { select: { id: true, name: true, color: true, icon: true } },
          subcategory: { select: { id: true, name: true, color: true, icon: true } },
          tags: { include: { tag: { select: { name: true } } } },
          installmentPlan: { select: { totalInstallments: true } },
        },
      }),
      prisma.category.findMany({
        where: { userId, parentId: null },
        orderBy: { name: "asc" },
        include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      }),
      prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
    ]);
  } catch (err) {
    console.error("[dashboard] erro ao carregar dados do banco:", err);
    throw err;
  }
  const [dashboardData, recentTransactions, categories, tags] = queryResult;

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const feedItems: TransactionListItem[] = recentTransactions.map((transaction) => ({
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
        installments={dashboardData.totals.installments}
        currentMonthKey={currentMonthKey}
        fixedExpenseTemplates={dashboardData.totals.fixedExpenseTemplates}
        incomeBreakdown={dashboardData.totals.incomeBreakdown}
        expenseBreakdown={dashboardData.totals.expenseBreakdown}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryDonutChart data={dashboardData.categoryDistribution} />
        <MonthlyTrendChart data={dashboardData.monthlyTrend} />
      </div>

      <InsightsPanel insights={dashboardData.insights} />

      <TransactionList
        transactions={feedItems}
        categories={categories.map((category) => ({
          id: category.id,
          name: category.name,
          children: category.children,
        }))}
        tagSuggestions={tags.map((tag) => tag.name)}
        title="Lançamentos recentes"
        description="Os 10 lançamentos mais recentes da sua conta"
        viewAllHref="/lancamentos"
        showHeaderAction={false}
      />
    </div>
  );
}
