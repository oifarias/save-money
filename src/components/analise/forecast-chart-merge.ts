import type { ExplorerDataPoint, ExplorerResult, ExplorerSeries } from "@/lib/analise-data";
import type { ForecastResult } from "@/lib/analise-forecast";

export const FORECAST_SERIES: ExplorerSeries = { key: "previsto", name: "Previsto", color: "#94a3b8", dashed: true };

/**
 * Combina o histórico real com os pontos futuros da previsão numa única série "previsto"
 * pontilhada. O bridge visual (repetir o valor do último mês real na chave "previsto", pra a
 * linha parecer contínua) só é seguro quando existe exatamente UMA série histórica — com
 * múltiplas categorias selecionadas não há um valor único pra "continuar", e usar uma chave
 * fixa (`value`) nesse caso desenharia um `previsto: 0` falso antes de saltar pro valor real.
 * Preferimos um pequeno gap visual a um dado incorreto no gráfico.
 *
 * Extraída para um módulo próprio (sem depender de `use-explorer-forecast.ts`) pra poder ser
 * testada sem puxar a action de servidor e sua cadeia de imports (auth, next-auth etc.).
 */
export function mergeForecastIntoChart(
  historical: ExplorerResult | null,
  forecast: ForecastResult | null,
  showForecast: boolean
): { chartData: ExplorerDataPoint[]; chartSeries: ExplorerSeries[] } {
  const data = historical?.data ?? [];
  const series = historical?.series ?? [];
  if (!showForecast || !forecast) return { chartData: data, chartSeries: series };

  let chartData = data;
  if (data.length > 0 && series.length === 1) {
    const seriesKey = series[0]!.key;
    const last = data[data.length - 1]!;
    chartData = [...data.slice(0, -1), { ...last, previsto: last[seriesKey] ?? 0 }];
  }

  return {
    chartData: [...chartData, ...forecast.points],
    chartSeries: [...series, FORECAST_SERIES],
  };
}
