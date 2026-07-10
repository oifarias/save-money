import { describe, expect, it } from "vitest";
import { mergeForecastIntoChart } from "./forecast-chart-merge";
import type { ExplorerResult } from "@/lib/analise-data";
import type { ForecastResult } from "@/lib/analise-forecast";

function historicalSingleSeries(): ExplorerResult {
  return {
    data: [
      { label: "abr/26", value: 1200 },
      { label: "mai/26", value: 1350 },
      { label: "jun/26", value: 1100 },
    ],
    series: [{ key: "value", name: "Total", color: "#1a9e6f" }],
    total: 3650,
    isEmpty: false,
  };
}

function historicalMultiCategory(): ExplorerResult {
  return {
    data: [
      { label: "mai/26", Alimentação: 800, Transporte: 300 },
      { label: "jun/26", Alimentação: 750, Transporte: 280 },
    ],
    series: [
      { key: "Alimentação", name: "Alimentação", color: "#f0a500" },
      { key: "Transporte", name: "Transporte", color: "#6366f1" },
    ],
    total: 2130,
    isEmpty: false,
  };
}

function forecastThreeMonths(): ForecastResult {
  return {
    points: [
      { label: "jul/26", previsto: 1180 },
      { label: "ago/26", previsto: 1180 },
      { label: "set/26", previsto: 1180 },
    ],
    rationale: { expense: [], income: [] },
    warnings: [],
  };
}

describe("mergeForecastIntoChart — como o gráfico da Análise mostra a previsão", () => {
  it("cliente sem filtro de grupo (série única 'value') liga a previsão: a linha fica contínua (ponte no último mês real)", () => {
    console.log("[cenário] cliente vê o total mensal (sem filtro de grupo) e liga 'Mostrar previsão'");
    const { chartData, chartSeries } = mergeForecastIntoChart(historicalSingleSeries(), forecastThreeMonths(), true);

    // O último ponto histórico (jun/26) ganha a chave "previsto" com o mesmo valor de "value",
    // pra linha aparecer contínua em vez de dar um salto visual.
    const juneBridge = chartData.find((d) => d.label === "jun/26");
    expect(juneBridge).toEqual({ label: "jun/26", value: 1100, previsto: 1100 });

    // Os 3 meses futuros foram concatenados ao final
    expect(chartData).toHaveLength(6);
    expect(chartData.slice(3)).toEqual(forecastThreeMonths().points);

    // Série "Previsto" tracejada foi adicionada
    expect(chartSeries.map((s) => s.key)).toEqual(["value", "previsto"]);
    expect(chartSeries.find((s) => s.key === "previsto")?.dashed).toBe(true);
  });

  it("cliente com 2 grupos selecionados (multi-série) liga a previsão: NÃO inventa um previsto=0 no último mês real", () => {
    console.log("[cenário] cliente filtra Alimentação + Transporte (2 grupos) e liga 'Mostrar previsão'");
    const { chartData } = mergeForecastIntoChart(historicalMultiCategory(), forecastThreeMonths(), true);

    // Bug corrigido: com múltiplas séries históricas não existe um valor único pra "continuar",
    // então os pontos históricos NÃO devem ganhar uma chave "previsto" (nem 0, nem qualquer valor).
    const junePoint = chartData.find((d) => d.label === "jun/26");
    expect(junePoint).toEqual({ label: "jun/26", Alimentação: 750, Transporte: 280 });
    expect(junePoint).not.toHaveProperty("previsto");

    // Os meses futuros ainda são anexados normalmente
    expect(chartData).toHaveLength(5);
  });

  it("cliente desliga a previsão: gráfico volta a mostrar só o histórico, sem série 'previsto'", () => {
    console.log("[cenário] cliente desativa o switch 'Mostrar previsão'");
    const historical = historicalSingleSeries();
    const { chartData, chartSeries } = mergeForecastIntoChart(historical, forecastThreeMonths(), false);

    expect(chartData).toEqual(historical.data);
    expect(chartSeries).toEqual(historical.series);
  });

  it("cliente liga a previsão antes dos dados históricos chegarem (loading): não quebra, sem histórico", () => {
    console.log("[cenário] usuário já ligou a previsão mas o fetch do histórico ainda não voltou");
    const { chartData, chartSeries } = mergeForecastIntoChart(null, forecastThreeMonths(), true);

    expect(chartData).toEqual(forecastThreeMonths().points);
    expect(chartSeries.map((s) => s.key)).toEqual(["previsto"]);
  });
});
