import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getExplorerData } from "@/lib/analise-data";
import type { ExplorerFilters } from "@/lib/analise-data";

/**
 * GET /api/analise/publica/[token]
 *
 * Rota pública — sem autenticação. Carrega os dados de uma visualização
 * compartilhada a partir do shareToken. Retorna 404 se o token for inválido
 * ou o compartilhamento estiver desativado.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
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

  if (!viz) {
    return NextResponse.json(
      { error: "Visualização não encontrada ou link inativo" },
      { status: 404 }
    );
  }

  const filters: ExplorerFilters = {
    ...(viz.filters as object),
    chartType: viz.chartType as ExplorerFilters["chartType"],
    groupBy: viz.groupBy as ExplorerFilters["groupBy"],
    showValues:
      (viz.displayOpts as { showValues?: boolean })?.showValues ?? true,
    showLegend:
      (viz.displayOpts as { showLegend?: boolean })?.showLegend ?? true,
  } as ExplorerFilters;

  const data = await getExplorerData(viz.userId, filters);

  return NextResponse.json({
    name: viz.name,
    description: viz.description,
    authorName: viz.user.name,
    data,
    filters,
  });
}
