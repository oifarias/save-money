"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { CategorySlice } from "@/lib/dashboard-data";

export function CategoryDonutChart({ data }: { data: CategorySlice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

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
                animationDuration={700}
                animationEasing="ease-out"
              >
                {data.map((slice) => (
                  <Cell key={slice.id} fill={slice.color} stroke="var(--color-surface)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value)), String(name)]}
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
          Total de despesas: <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(total)}</span>
        </p>
      )}
    </Card>
  );
}
