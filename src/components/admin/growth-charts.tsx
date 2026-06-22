"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { MonthlyGrowthPoint } from "@/lib/admin-data";

function GrowthChart({
  title,
  subtitle,
  data,
  dataKey,
  color,
}: {
  title: string;
  subtitle: string;
  data: MonthlyGrowthPoint[];
  dataKey: "users" | "transactions";
  color: string;
}) {
  return (
    <Card>
      <h3 className="font-display text-base font-semibold text-(--color-text)">{title}</h3>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">{subtitle}</p>

      <div className="h-64">
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
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontSize: 13,
              }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function GrowthCharts({ data }: { data: MonthlyGrowthPoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GrowthChart
        title="Novos usuários por mês"
        subtitle="Últimos 12 meses"
        data={data}
        dataKey="users"
        color="var(--color-primary)"
      />
      <GrowthChart
        title="Lançamentos cadastrados por mês"
        subtitle="Últimos 12 meses"
        data={data}
        dataKey="transactions"
        color="var(--color-accent)"
      />
    </div>
  );
}
