"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { useValuesVisibility } from "@/contexts/values-visibility";
import type { CategorySlice } from "@/lib/dashboard-data";

const CHART_PALETTE = [
  "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED",
  "#0D9488", "#DB2777", "#EA580C", "#0284C7", "#4C1D95",
  "#15803D", "#991B1B", "#1D4ED8", "#9333EA", "#0F766E",
];

function resolveColors(data: CategorySlice[]): string[] {
  const colorCount = new Map<string, number>();
  for (const slice of data) colorCount.set(slice.color, (colorCount.get(slice.color) ?? 0) + 1);
  let paletteIndex = 0;
  return data.map((slice) => {
    if ((colorCount.get(slice.color) ?? 0) === 1) return slice.color;
    return CHART_PALETTE[paletteIndex++ % CHART_PALETTE.length];
  });
}

export function CategoryDonutChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const { showValues } = useValuesVisibility();
  const colors = resolveColors(data);

  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Gastos por grupo</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Distribuição das despesas do mês atual</p>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-(--color-text-muted)">
          Sem despesas registradas neste mês ainda
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="85%"
                paddingAngle={2}
                isAnimationActive
                animationBegin={180}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {data.map((slice, index) => (
                  <Cell key={slice.id} fill={colors[index]} stroke="var(--color-surface)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [showValues ? formatCurrency(Number(value)) : "R$ ••••", String(name)]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-text)",
                  fontSize: 13,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={48}
                wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {data.length > 0 && (
        <p className="mt-2 text-center text-xs text-(--color-text-muted)">
          Total de despesas: <span className="font-numeric font-medium text-(--color-text)"><Money value={total} /></span>
        </p>
      )}
    </Card>
  );
}
