import { prisma } from "@/lib/prisma";
import { monthLabel } from "@/lib/format";

export type AdminKpis = {
  totalUsers: number;
  totalTransactions: number;
  totalInsights: number;
  totalSharedSplits: number;
  avgTransactionsPerUser: number;
  avgTransactionAmount: number;
  totalVolume: number;
};

export type MonthlyGrowthPoint = {
  label: string;
  users: number;
  transactions: number;
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

export async function getAdminKpis(): Promise<AdminKpis> {
  const [totalUsers, totalTransactions, totalInsights, totalSharedSplits, amountAgg] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count(),
    prisma.fixedExpenseInsightDecision.count(),
    prisma.sharedSplit.count(),
    prisma.transaction.aggregate({ _avg: { amount: true }, _sum: { amount: true } }),
  ]);

  return {
    totalUsers,
    totalTransactions,
    totalInsights,
    totalSharedSplits,
    avgTransactionsPerUser: totalUsers > 0 ? totalTransactions / totalUsers : 0,
    avgTransactionAmount: amountAgg._avg.amount ?? 0,
    totalVolume: amountAgg._sum.amount ?? 0,
  };
}

type GrowthRow = { month: Date; total: bigint };

export async function getMonthlyGrowth(): Promise<MonthlyGrowthPoint[]> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const rangeStart = addMonths(monthStart, -11);

  const [userRows, transactionRows] = await Promise.all([
    prisma.$queryRaw<GrowthRow[]>`
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS total
      FROM "users"
      WHERE "createdAt" >= ${rangeStart} AND "createdAt" < ${nextMonthStart}
      GROUP BY date_trunc('month', "createdAt")
    `,
    prisma.$queryRaw<GrowthRow[]>`
      SELECT date_trunc('month', "createdAt") AS month, COUNT(*) AS total
      FROM "transactions"
      WHERE "createdAt" >= ${rangeStart} AND "createdAt" < ${nextMonthStart}
      GROUP BY date_trunc('month', "createdAt")
    `,
  ]);

  const points: MonthlyGrowthPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const point = addMonths(rangeStart, i);
    const usersRow = userRows.find((row) => startOfMonth(new Date(row.month)).getTime() === point.getTime());
    const transactionsRow = transactionRows.find(
      (row) => startOfMonth(new Date(row.month)).getTime() === point.getTime()
    );
    points.push({
      label: monthLabel(point),
      users: usersRow ? Number(usersRow.total) : 0,
      transactions: transactionsRow ? Number(transactionsRow.total) : 0,
    });
  }

  return points;
}
