import { auth } from "@/lib/auth";
import { getInsightsPageData } from "@/lib/insights-data";
import {
  CategoryAveragesCard,
  FixedExpenseAlertCard,
  GrowthRankingCard,
  HashtagRankingCard,
  InstallmentForecastCard,
  ReductionSuggestionsCard,
} from "@/components/insights/insight-sections";
import { PageHeader } from "@/components/ui/page-header";

export default async function InsightsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const data = await getInsightsPageData(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Insights e recomendações" description="Análises detalhadas de tendências, hashtags e sugestões de economia baseadas nos seus dados" />

      {!data.hasData ? (
        <p className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-8 text-center text-sm text-(--color-text-muted)">
          Registre lançamentos de despesas em alguns meses para começar a receber análises e recomendações personalizadas.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <GrowthRankingCard data={data.categoryGrowth} windowLabel={data.growthWindowLabel} />
          <FixedExpenseAlertCard
            data={data.fixedExpenseAlert}
            candidates={data.fixedExpenseCandidates}
            resolved={data.fixedExpenseResolvedInsights}
          />
          <InstallmentForecastCard data={data.installmentForecasts} />
          <CategoryAveragesCard data={data.categoryAverages} windowLabel={data.windowLabel} />
          <HashtagRankingCard data={data.hashtagRanking} />
          <div className="lg:col-span-2">
            <ReductionSuggestionsCard data={data.reductionSuggestions} />
          </div>
        </div>
      )}
    </div>
  );
}
