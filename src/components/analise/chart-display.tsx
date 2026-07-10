"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from "recharts";
import { formatCurrency } from "@/lib/format";
import type { ExplorerDataPoint, ExplorerSeries, ExplorerFilters } from "@/lib/analise-data";

type Props = {
  data: ExplorerDataPoint[];
  series: ExplorerSeries[];
  chartType: ExplorerFilters["chartType"];
  showValues: boolean;
  showLegend: boolean;
};

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  fontSize: 13,
};

const compact = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v);

const axisStyle = { fontSize: 11, fill: "var(--color-text-muted)" };

function EmptyChart() {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-(--color-text-muted)">
      Nenhum dado para os filtros selecionados
    </div>
  );
}

export function ChartDisplay({ data, series, chartType, showValues, showLegend }: Props) {
  if (data.length === 0) return <EmptyChart />;

  const hasCellColors = data.length > 0 && "color" in data[0]!;

  if (chartType === "bar-vertical") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={60} tickFormatter={compact} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && series.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} fillOpacity={s.dashed ? 0.5 : 1} radius={[6, 6, 0, 0]}>
                {hasCellColors &&
                  data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={String(entry.color ?? s.color)} />
                  ))}
                {showValues && <LabelList dataKey={s.key} position="top" style={{ fontSize: 10, fill: "var(--color-text-muted)" }} formatter={(v: unknown) => compact(Number(v))} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "bar-horizontal") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 60, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
            <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={compact} />
            <YAxis type="category" dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} width={100} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && series.length > 1 && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} fillOpacity={s.dashed ? 0.5 : 1} radius={[0, 6, 6, 0]}>
                {hasCellColors &&
                  data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={String(entry.color ?? s.color)} />
                  ))}
                {showValues && <LabelList dataKey={s.key} position="right" style={{ fontSize: 10, fill: "var(--color-text-muted)" }} formatter={(v: unknown) => compact(Number(v))} />}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "line") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={60} tickFormatter={compact} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                dot={false}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
              >
                {showValues && <LabelList dataKey={s.key} position="top" style={{ fontSize: 10, fill: "var(--color-text-muted)" }} formatter={(v: unknown) => compact(Number(v))} />}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "area") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={60} tickFormatter={compact} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "6 4" : undefined}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "pie") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={String(entry.color ?? series[0]?.color ?? "#1a9e6f")} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
              {showValues && <LabelList dataKey="value" style={{ fontSize: 10, fill: "#fff" }} formatter={(v: unknown) => compact(Number(v))} />}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "donut") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={String(entry.color ?? series[0]?.color ?? "#1a9e6f")} stroke="var(--color-surface)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (chartType === "stacked-bar") {
    return (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: "var(--color-border)" }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={60} tickFormatter={compact} />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value))]}
              contentStyle={tooltipStyle}
            />
            {showLegend && (
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--color-text-muted)" }} />
            )}
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color}
                fillOpacity={s.dashed ? 0.5 : 1}
                stackId="stack"
                radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return <EmptyChart />;
}
