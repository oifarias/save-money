import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getExplorerData } from "@/lib/analise-data";
import type { ExplorerFilters } from "@/lib/analise-data";
import { ChartDisplay } from "@/components/analise/chart-display";
import { Logo } from "@/components/branding/logo";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";

export default async function PublicVisualizationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const viz = await prisma.savedVisualization.findFirst({
    where: { shareToken: token, shareActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      chartType: true,
      groupBy: true,
      filters: true,
      displayOpts: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  if (!viz) notFound();

  const filtersRaw = viz.filters as Omit<ExplorerFilters, "chartType" | "groupBy" | "showValues" | "showLegend">;
  const displayOpts = (viz.displayOpts ?? {}) as { showValues?: boolean; showLegend?: boolean };

  const filters: ExplorerFilters = {
    ...filtersRaw,
    chartType: viz.chartType as ExplorerFilters["chartType"],
    groupBy: viz.groupBy as ExplorerFilters["groupBy"],
    showValues: displayOpts.showValues ?? true,
    showLegend: displayOpts.showLegend ?? true,
  };

  const result = await getExplorerData(viz.userId, filters);

  return (
    <div className="min-h-screen bg-(--color-bg) p-4 sm:p-8">
      <div className="mx-auto max-w-4xl flex flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-semibold text-(--color-text)">
          <Logo size={28} />
          Save Money
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-(--color-text)">{viz.name}</h1>
            {viz.description && (
              <p className="mt-1 text-sm text-(--color-text-muted)">{viz.description}</p>
            )}
            <p className="mt-2 text-xs text-(--color-text-muted)">Criado por {viz.user.name}</p>
          </div>
          <Link
            href="/login"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-white hover:brightness-105 transition-all"
          >
            Criar minha análise
          </Link>
        </div>

        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-6">
          <ChartDisplay
            data={result.data}
            series={result.series}
            chartType={filters.chartType}
            showValues={filters.showValues}
            showLegend={filters.showLegend}
          />
          {!result.isEmpty && (
            <p className="mt-3 text-right text-xs text-(--color-text-muted)">
              Total:{" "}
              <span className="font-numeric font-medium text-(--color-text)">
                {formatCurrency(result.total)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
