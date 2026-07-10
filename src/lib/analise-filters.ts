import type { ExplorerFilters } from "@/lib/analise-data";

/**
 * Escopo de grupo/subgrupo compartilhado entre `getExplorerData` e `getExplorerForecast`
 * (análise histórica e previsão usam a mesma noção de "quais categorias/subcategorias
 * estão filtradas na tela"). Defesa `?? []` em `subcategoryIds`: pontos de entrada públicos
 * (visualização compartilhada) reconstroem `ExplorerFilters` a partir de JSON salvo no banco
 * sem passar pelo Zod schema — visualizações salvas antes deste campo existir não o terão.
 *
 * Vive num arquivo à parte (em vez de `analise-data.ts`) porque esse é um módulo "use server"
 * — Next.js só permite exportar funções async de lá, e esta é síncrona/pura.
 */
export function buildCategoryScope(filters: Pick<ExplorerFilters, "categoryIds" | "subcategoryIds">): {
  categoryId?: { in: string[] };
  subcategoryId?: { in: string[] };
} {
  const scope: { categoryId?: { in: string[] }; subcategoryId?: { in: string[] } } = {};
  if (filters.categoryIds.length > 0) {
    scope.categoryId = { in: filters.categoryIds };
  }
  const subcategoryIds = filters.subcategoryIds ?? [];
  if (subcategoryIds.length > 0) {
    scope.subcategoryId = { in: subcategoryIds };
  }
  return scope;
}

/**
 * Quando exatamente um grupo está selecionado e o agrupamento é "por grupo", tanto o cálculo
 * (servidor) quanto a legenda "Mostrando subgrupos de..." (cliente) precisam concordar sobre
 * quando o drill-down automático por subgrupo está ativo — daí a regra viver num só lugar.
 */
export function isSubgroupDrilldown(filters: Pick<ExplorerFilters, "groupBy" | "categoryIds">): boolean {
  return filters.groupBy === "category" && filters.categoryIds.length === 1;
}
