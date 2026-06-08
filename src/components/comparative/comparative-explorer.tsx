"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { ComparativeData } from "@/lib/comparative-data";

type TypeFilter = "EXPENSE" | "INCOME" | "ALL";

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "EXPENSE", label: "Despesas" },
  { value: "INCOME", label: "Entradas" },
  { value: "ALL", label: "Ambos" },
];

const SERIES_COLORS = ["#1A9E6F", "#F0A500", "#3B82C4", "#A855C9", "#E84040", "#22C97A"];
const GROWTH_HIGHLIGHT_THRESHOLD = 10;
const MAX_SELECTABLE_MONTHS = 6;

function valueForFilter(entry: { expense: number; income: number } | undefined, filter: TypeFilter) {
  if (!entry) return 0;
  if (filter === "EXPENSE") return entry.expense;
  if (filter === "INCOME") return entry.income;
  return entry.expense + entry.income;
}

export function ComparativeExplorer({ data }: { data: ComparativeData }) {
  const defaultSelection = data.months.slice(-2).map((month) => month.key);
  const [selectedMonths, setSelectedMonths] = useState<string[]>(defaultSelection);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("EXPENSE");

  const orderedSelection = useMemo(
    () => data.months.filter((month) => selectedMonths.includes(month.key)),
    [data.months, selectedMonths]
  );

  function toggleMonth(key: string) {
    setSelectedMonths((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }
      if (current.length >= MAX_SELECTABLE_MONTHS) {
        return current;
      }
      return [...current, key];
    });
  }

  const rows = useMemo(() => {
    if (orderedSelection.length < 2) return [];

    const first = orderedSelection[0];
    const last = orderedSelection[orderedSelection.length - 1];

    return data.categories
      .map((category) => {
        const values = orderedSelection.map((month) => valueForFilter(data.totals[month.key]?.[category.id], typeFilter));
        const firstValue = valueForFilter(data.totals[first.key]?.[category.id], typeFilter);
        const lastValue = valueForFilter(data.totals[last.key]?.[category.id], typeFilter);
        const variation = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : lastValue > 0 ? 100 : 0;

        return { category, values, total: values.reduce((sum, value) => sum + value, 0), variation };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [data, orderedSelection, typeFilter]);

  const chartData = useMemo(
    () =>
      rows.map((row) => {
        const point: Record<string, string | number> = { name: row.category.name };
        orderedSelection.forEach((month, index) => {
          point[month.key] = row.values[index];
        });
        return point;
      }),
    [rows, orderedSelection]
  );

  function handleExport() {
    if (typeof window === "undefined" || rows.length === 0) return;

    import("xlsx").then((XLSX) => {
      const header = ["Grupo", ...orderedSelection.map((month) => month.label), "Variação %"];
      const body = rows.map((row) => [
        row.category.name,
        ...row.values,
        Number(row.variation.toFixed(1)),
      ]);

      const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);
      worksheet["!cols"] = [{ wch: 22 }, ...orderedSelection.map(() => ({ wch: 14 })), { wch: 14 }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Comparativo");
      XLSX.writeFile(workbook, "comparativo-save-money.xlsx");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-(--color-text)">Selecione os meses</h2>
          <p className="mt-0.5 text-xs text-(--color-text-muted)">
            Escolha entre 2 e {MAX_SELECTABLE_MONTHS} meses dos últimos {data.months.length} para comparar
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.months.map((month) => {
            const checked = selectedMonths.includes(month.key);
            return (
              <button
                key={month.key}
                type="button"
                onClick={() => toggleMonth(month.key)}
                aria-pressed={checked}
                className={clsx(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors duration-200",
                  checked
                    ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
                    : "border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/50 hover:text-(--color-text)"
                )}
              >
                {month.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-(--color-text)">Tipo</span>
          <div className="inline-flex w-fit overflow-hidden rounded-xl border border-(--color-border)">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTypeFilter(option.value)}
                className={clsx(
                  "px-4 py-2 text-sm font-medium transition-colors duration-200",
                  typeFilter === option.value
                    ? "bg-(--color-primary) text-white"
                    : "bg-(--color-surface) text-(--color-text-muted) hover:text-(--color-text)"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {orderedSelection.length < 2 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <p className="text-sm text-(--color-text-muted)">Selecione pelo menos dois meses para ver o comparativo</p>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-14 text-center">
          <p className="text-sm text-(--color-text-muted)">
            Sem lançamentos do tipo selecionado nesses meses
          </p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-(--color-text)">Comparativo por grupo</h3>
                <p className="mt-0.5 text-xs text-(--color-text-muted)">
                  Variação calculada entre {orderedSelection[0].label} e {orderedSelection[orderedSelection.length - 1].label}
                  {" · "}grupos com crescimento acima de {GROWTH_HIGHLIGHT_THRESHOLD}% em destaque
                </p>
              </div>
              <Button type="button" variant="secondary" onClick={handleExport}>
                <Download size={16} aria-hidden="true" />
                Exportar Excel
              </Button>
            </div>

            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                    axisLine={{ stroke: "var(--color-border)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat("pt-BR", { notation: "compact", compactDisplay: "short" }).format(value)
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(Number(value)),
                      orderedSelection.find((month) => month.key === name)?.label ?? String(name),
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-text)",
                      fontSize: 13,
                    }}
                  />
                  <Legend
                    formatter={(value) => orderedSelection.find((month) => month.key === value)?.label ?? String(value)}
                    wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  />
                  {orderedSelection.map((month, index) => (
                    <Bar
                      key={month.key}
                      dataKey={month.key}
                      name={month.key}
                      fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                      radius={[6, 6, 0, 0]}
                      animationDuration={700}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-(--color-border) text-xs uppercase tracking-wide text-(--color-text-muted)">
                  <th className="px-3 py-2">Grupo</th>
                  {orderedSelection.map((month) => (
                    <th key={month.key} className="px-3 py-2 text-right capitalize">
                      {month.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Variação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isHighGrowth = row.variation > GROWTH_HIGHLIGHT_THRESHOLD;
                  const isDrop = row.variation < 0;
                  return (
                    <tr key={row.category.id} className="border-b border-(--color-border) last:border-0">
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-(--color-text)">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: row.category.color }}
                            aria-hidden="true"
                          />
                          {row.category.name}
                        </span>
                      </td>
                      {row.values.map((value, index) => (
                        <td key={orderedSelection[index].key} className="px-3 py-2 text-right font-numeric text-(--color-text)">
                          {formatCurrency(value)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                            isHighGrowth
                              ? "bg-(--color-danger)/10 text-(--color-danger)"
                              : isDrop
                                ? "bg-(--color-success)/10 text-(--color-success)"
                                : "bg-(--color-border)/50 text-(--color-text-muted)"
                          )}
                        >
                          {isDrop ? <TrendingDown size={13} aria-hidden="true" /> : <TrendingUp size={13} aria-hidden="true" />}
                          {row.variation > 0 ? "+" : ""}
                          {row.variation.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
