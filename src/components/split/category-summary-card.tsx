"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { summarizeSplitByCategory } from "@/lib/split-categories";
import type { PublicSplit } from "@/lib/split-data";

const CHART_PALETTE = [
  "#2563EB", "#16A34A", "#DC2626", "#D97706", "#7C3AED",
  "#0D9488", "#DB2777", "#EA580C", "#0284C7", "#4C1D95",
  "#15803D", "#991B1B", "#1D4ED8", "#9333EA", "#0F766E",
];

/** Garante uma cor única por fatia: mantém a cor da categoria quando ela não se repete. */
function resolveColors(slices: { color: string | null }[]): string[] {
  const colorCount = new Map<string, number>();
  for (const slice of slices) {
    if (slice.color) colorCount.set(slice.color, (colorCount.get(slice.color) ?? 0) + 1);
  }
  let paletteIndex = 0;
  return slices.map((slice) => {
    if (slice.color && (colorCount.get(slice.color) ?? 0) === 1) return slice.color;
    return CHART_PALETTE[paletteIndex++ % CHART_PALETTE.length];
  });
}

export function CategorySummaryCard({ split }: { split: PublicSplit }) {
  const categories = useMemo(() => summarizeSplitByCategory(split), [split]);
  const [openName, setOpenName] = useState<string | null>(null);

  const colors = resolveColors(categories);
  const chartData = categories.map((category) => ({ name: category.name, value: category.total }));

  if (categories.length === 0) return null;

  return (
    <Card>
      <h2 className="font-display text-sm font-semibold text-(--color-text)">Resumo por categoria</h2>
      <p className="mt-0.5 text-xs text-(--color-text-muted)">
        Toque em uma categoria para ver quanto cada pessoa paga.
      </p>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={2}
              isAnimationActive
              animationBegin={180}
              animationDuration={900}
              animationEasing="ease-out"
            >
              {categories.map((category, index) => (
                <Cell key={category.name} fill={colors[index]} stroke="var(--color-surface)" strokeWidth={2} />
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
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="mt-1 flex flex-col gap-2">
        {categories.map((category, index) => {
          const isOpen = openName === category.name;
          return (
            <li key={category.name} className="overflow-hidden rounded-xl bg-(--color-bg)">
              <button
                type="button"
                onClick={() => setOpenName(isOpen ? null : category.name)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: colors[index] }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-(--color-text)">{category.name}</span>
                  <ChevronDown
                    className={clsx(
                      "h-3.5 w-3.5 shrink-0 text-(--color-text-muted) transition-transform duration-200",
                      isOpen && "rotate-180"
                    )}
                    aria-hidden="true"
                  />
                </span>
                <span className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
                  {formatCurrency(category.total)}
                </span>
              </button>

              {isOpen && (
                <div className="flex flex-col gap-1.5 border-t border-(--color-border) px-3.5 py-2.5">
                  {category.people.length === 0 ? (
                    <p className="text-xs text-(--color-text-muted)">Nenhuma pessoa vinculada a essa categoria.</p>
                  ) : (
                    category.people.map((person) => (
                      <div key={person.participantId} className="flex items-center justify-between gap-3 text-xs">
                        <span className="text-(--color-text-muted)">{person.name} paga</span>
                        <span className="font-numeric font-medium text-(--color-text)">
                          {formatCurrency(person.amount)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
