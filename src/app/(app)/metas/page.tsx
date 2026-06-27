import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  currentMonthKey,
  ensureCurrentMonthBudgets,
  getBudgetProgress,
  getCategoryHistoricalAverages,
  getIncomeBaseline,
  getInstallmentCommitmentsByCategory,
} from "@/lib/budget-data";
import type { Bucket } from "@/lib/budget-buckets";
import { GoalsWizard } from "@/components/goals/goals-wizard";
import { BudgetProgressView } from "@/components/goals/budget-progress-view";
import { PageHeader } from "@/components/ui/page-header";

type MetasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MetasPage({ searchParams }: MetasPageProps) {
  const session = await auth();
  const userId = session!.user.id;
  const month = currentMonthKey();

  const rawSearchParams = await searchParams;
  const forceWizard = Boolean(rawSearchParams.recalcular);

  // ensureCurrentMonthBudgets precisa terminar ANTES de getBudgetProgress (senão a leitura pode
  // acontecer antes da cópia do mês anterior, mostrando o wizard indevidamente) — mas não depende
  // da busca de categorias, então essas duas rodam em paralelo.
  const [, rootCategories] = await Promise.all([
    ensureCurrentMonthBudgets(userId, month),
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, icon: true },
    }),
  ]);

  const progress = await getBudgetProgress(userId, month);

  const showWizard = !progress || forceWizard;
  const [incomeBaseline, categoryAveragesMap, committedByCategoryMap] = showWizard
    ? await Promise.all([
        getIncomeBaseline(userId, month),
        getCategoryHistoricalAverages(userId),
        getInstallmentCommitmentsByCategory(userId, month),
      ])
    : [null, new Map<string, number>(), new Map<string, number>()];

  const existingBudgets = progress?.categories.map((c) => ({
    categoryId: c.categoryId,
    bucket: c.bucket as Bucket,
    limitAmount: c.limitAmount,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Metas de gastos" description="Defina quanto pretende gastar por grupo este mês e acompanhe o quanto já usou" />

      {!showWizard && progress ? (
        <BudgetProgressView progress={progress} />
      ) : (
        <GoalsWizard
          categories={rootCategories}
          incomeBaseline={incomeBaseline}
          categoryAverages={Object.fromEntries(categoryAveragesMap)}
          committedByCategory={Object.fromEntries(committedByCategoryMap)}
          existingBudgets={existingBudgets}
        />
      )}
    </div>
  );
}
