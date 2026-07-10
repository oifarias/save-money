"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { fetchExplorerForecastAction } from "@/app/(app)/analise/actions";
import { mergeForecastIntoChart } from "@/components/analise/forecast-chart-merge";
import type { ExplorerFilters as ExplorerFiltersType, ExplorerResult } from "@/lib/analise-data";
import type { ForecastHorizon, ForecastOverrides, ForecastResult } from "@/lib/analise-forecast";

export function useExplorerForecast(filters: ExplorerFiltersType, historicalResult: ExplorerResult | null) {
  const [enabled, setEnabled] = useState(false);
  const [horizon, setHorizon] = useState<ForecastHorizon>(3);
  const [overrides, setOverrides] = useState<ForecastOverrides>({});
  const [result, setResult] = useState<ForecastResult | null>(null);

  // Previsão só faz sentido agrupando por mês — desliga automaticamente ao sair desse modo.
  // Ajustamos o state durante o render (comparando com o groupBy anterior) em vez de usar um
  // useEffect: é o padrão oficial do React para "reagir a um valor mudando" e evita a violação
  // da regra de lint react-hooks/set-state-in-effect (setState síncrono dentro de efeitos).
  // https://react.dev/learn/you-might-not-need-an-effect
  const [prevGroupBy, setPrevGroupBy] = useState(filters.groupBy);
  if (filters.groupBy !== prevGroupBy) {
    setPrevGroupBy(filters.groupBy);
    if (filters.groupBy !== "month" && enabled) setEnabled(false);
  }

  // Só os campos que realmente entram no cálculo do servidor (getExplorerForecast) viram
  // dependência do fetch abaixo — mudar chartType/showValues/showLegend não deve disparar uma
  // nova busca de previsão.
  const scopeKey = useMemo(
    () =>
      JSON.stringify({
        type: filters.type,
        categoryIds: filters.categoryIds,
        subcategoryIds: filters.subcategoryIds,
        tagIds: filters.tagIds,
        period: filters.period,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        groupBy: filters.groupBy,
      }),
    [
      filters.type,
      filters.categoryIds,
      filters.subcategoryIds,
      filters.tagIds,
      filters.period,
      filters.dateFrom,
      filters.dateTo,
      filters.groupBy,
    ]
  );

  useEffect(() => {
    if (!enabled || filters.groupBy !== "month") return;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchExplorerForecastAction(filters, horizon, overrides);
        if (!cancelled) setResult(data);
      } catch {
        if (!cancelled) toast.error("Erro ao buscar previsão");
      }
    })();
    return () => {
      cancelled = true;
    };
  // scopeKey já resume os campos de `filters` relevantes pro cálculo — usar `filters` inteiro
  // como dependência refaria a busca a cada mudança de chartType/showValues/showLegend.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, horizon, overrides, scopeKey]);

  function handleOverrideChange(kind: "expense" | "income", key: string, value: number | null) {
    setOverrides((prev) => {
      const next = { ...prev, [kind]: { ...prev[kind] } };
      if (value === null) {
        delete next[kind]![key];
      } else {
        next[kind]![key] = value;
      }
      return next;
    });
  }

  const showForecast = enabled && filters.groupBy === "month" && Boolean(result);
  const { chartData, chartSeries } = useMemo(
    () => mergeForecastIntoChart(historicalResult, result, showForecast),
    [historicalResult, result, showForecast]
  );

  return {
    enabled,
    setEnabled,
    horizon,
    setHorizon,
    overrides,
    handleOverrideChange,
    result,
    showForecast,
    chartData,
    chartSeries,
  };
}
