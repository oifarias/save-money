import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Explorer } from "@/components/analise/explorer";
import type { ExplorerFilters } from "@/lib/analise-data";

export default async function AnaliseSalvaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const [viz, categories, tags] = await Promise.all([
    prisma.savedVisualization.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        chartType: true,
        groupBy: true,
        filters: true,
        displayOpts: true,
        shareActive: true,
        shareToken: true,
      },
    }),
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!viz) notFound();

  const filtersFromDb = viz.filters as Omit<ExplorerFilters, "chartType" | "groupBy" | "showValues" | "showLegend">;
  const displayOpts = (viz.displayOpts ?? {}) as { showValues?: boolean; showLegend?: boolean };

  const initialFilters: ExplorerFilters = {
    ...filtersFromDb,
    chartType: viz.chartType as ExplorerFilters["chartType"],
    groupBy: viz.groupBy as ExplorerFilters["groupBy"],
    showValues: displayOpts.showValues ?? true,
    showLegend: displayOpts.showLegend ?? true,
  };

  return (
    <Explorer
      categories={categories}
      tags={tags}
      initialFilters={initialFilters}
      savedViz={{
        id: viz.id,
        name: viz.name,
        chartType: viz.chartType,
        shareActive: viz.shareActive,
        shareToken: viz.shareToken,
      }}
    />
  );
}
