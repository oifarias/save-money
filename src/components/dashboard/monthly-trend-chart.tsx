"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { MonthlyTrendPoint } from "@/lib/dashboard-data";

export function MonthlyTrendChart({ data }: { data: MonthlyTrendPoint[] }) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">Entradas x Saídas</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">Evolução nos últimos 6 meses</p>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
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
              formatter={(value, name) => [formatCurrency(Number(value)), name === "income" ? "Entradas" : "Saídas"]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value) => (value === "income" ? "Entradas" : "Saídas")}
              wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }}
            />
            <Bar dataKey="income" name="income" fill="var(--color-success)" radius={[6, 6, 0, 0]} animationDuration={700} />
            <Bar dataKey="expense" name="expense" fill="var(--color-danger)" radius={[6, 6, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
