import { describe, expect, it } from "vitest";
import { buildCategoryScope, isSubgroupDrilldown } from "./analise-filters";
import type { ExplorerFilters } from "./analise-data";

function baseFilters(overrides: Partial<ExplorerFilters> = {}): ExplorerFilters {
  return {
    categoryIds: [],
    subcategoryIds: [],
    tagIds: [],
    type: "EXPENSE",
    dateFrom: null,
    dateTo: null,
    period: "30",
    groupBy: "category",
    chartType: "bar-vertical",
    showValues: true,
    showLegend: true,
    ...overrides,
  };
}

describe("isSubgroupDrilldown — regra de drill-down automático da tela de Análise", () => {
  it("cliente filtra só o grupo 'Alimentação' e agrupa por grupo: ativa o drill-down", () => {
    console.log("[cenário] cliente seleciona 1 grupo (Alimentação) agrupando por grupo → deve ver subgrupos");
    const filters = baseFilters({ categoryIds: ["cat-alimentacao"], groupBy: "category" });
    expect(isSubgroupDrilldown(filters)).toBe(true);
  });

  it("cliente filtra 2 grupos ao mesmo tempo: não ativa o drill-down (ambíguo a quem detalhar)", () => {
    console.log("[cenário] cliente seleciona Alimentação + Transporte → mantém visão por grupo, sem drill-down");
    const filters = baseFilters({ categoryIds: ["cat-alimentacao", "cat-transporte"], groupBy: "category" });
    expect(isSubgroupDrilldown(filters)).toBe(false);
  });

  it("cliente não filtra nenhum grupo: não ativa o drill-down", () => {
    console.log("[cenário] cliente sem filtro de grupo, vendo o total de todos os grupos");
    const filters = baseFilters({ categoryIds: [], groupBy: "category" });
    expect(isSubgroupDrilldown(filters)).toBe(false);
  });

  it("cliente filtra 1 grupo mas está agrupando por mês: não ativa (regra só vale em 'por grupo')", () => {
    console.log("[cenário] cliente seleciona 1 grupo, mas troca pra visão 'Por mês'");
    const filters = baseFilters({ categoryIds: ["cat-alimentacao"], groupBy: "month" });
    expect(isSubgroupDrilldown(filters)).toBe(false);
  });
});

describe("buildCategoryScope — escopo de grupo/subgrupo compartilhado entre Análise e Previsão", () => {
  it("cliente sem nenhum filtro de grupo/subgrupo: escopo vazio (todas as transações do usuário)", () => {
    console.log("[cenário] cliente novo, ainda sem filtrar nada na tela de Análise");
    expect(buildCategoryScope(baseFilters())).toEqual({});
  });

  it("cliente filtra só grupos: escopo restringe só por categoryId", () => {
    console.log("[cenário] cliente filtra os grupos Alimentação e Lazer");
    const scope = buildCategoryScope(baseFilters({ categoryIds: ["cat-alimentacao", "cat-lazer"] }));
    expect(scope).toEqual({ categoryId: { in: ["cat-alimentacao", "cat-lazer"] } });
  });

  it("cliente filtra grupo e subgrupo juntos: escopo combina os dois filtros", () => {
    console.log("[cenário] cliente filtra o grupo Alimentação e o subgrupo Mercado");
    const scope = buildCategoryScope(
      baseFilters({ categoryIds: ["cat-alimentacao"], subcategoryIds: ["sub-mercado"] })
    );
    expect(scope).toEqual({
      categoryId: { in: ["cat-alimentacao"] },
      subcategoryId: { in: ["sub-mercado"] },
    });
  });

  it("visualização salva antes do filtro de subgrupo existir (subcategoryIds ausente): não quebra", () => {
    console.log("[cenário] cliente abre uma análise salva há meses, sem o campo subcategoryIds no JSON salvo");
    const legacyFilters = baseFilters({ categoryIds: ["cat-alimentacao"] });
    // @ts-expect-error — simula o JSON legado reconstruído sem passar pelo Zod, como acontece de verdade
    delete legacyFilters.subcategoryIds;
    expect(buildCategoryScope(legacyFilters)).toEqual({ categoryId: { in: ["cat-alimentacao"] } });
  });
});
