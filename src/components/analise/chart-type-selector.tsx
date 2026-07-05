"use client";

import { BarChart2, AlignLeft, TrendingUp, Activity, PieChart, Disc, Layers } from "lucide-react";
import type { ExplorerFilters } from "@/lib/analise-data";

type Props = {
  value: ExplorerFilters["chartType"];
  onChange: (type: ExplorerFilters["chartType"]) => void;
};

const CHART_OPTIONS: {
  type: ExplorerFilters["chartType"];
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "bar-vertical", label: "Barras", Icon: BarChart2 },
  { type: "bar-horizontal", label: "Horizontal", Icon: AlignLeft },
  { type: "line", label: "Linha", Icon: TrendingUp },
  { type: "area", label: "Área", Icon: Activity },
  { type: "pie", label: "Pizza", Icon: PieChart },
  { type: "donut", label: "Donut", Icon: Disc },
  { type: "stacked-bar", label: "Empilhado", Icon: Layers },
];

export function ChartTypeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {CHART_OPTIONS.map(({ type, label, Icon }) => {
        const isActive = value === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all ${
              isActive
                ? "bg-(--color-primary) text-white"
                : "border border-(--color-border) text-(--color-text-muted) hover:border-(--color-primary)/40 hover:text-(--color-text)"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
