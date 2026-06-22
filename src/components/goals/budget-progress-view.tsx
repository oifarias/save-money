import Link from "next/link";
import { clsx } from "clsx";
import { RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CategoryDonutChart } from "@/components/dashboard/category-donut-chart";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import type { BudgetProgress } from "@/lib/budget-data";

export function BudgetProgressView({ progress }: { progress: BudgetProgress }) {
  const donutData = [
    { id: "necessidade", name: "Necessidades", color: "#1A9E6F", value: progress.necessidade.spent },
    { id: "desejo", name: "Desejos", color: "#F0A500", value: progress.desejo.spent },
    { id: "poupanca", name: "Sobra do mês", color: "#3B82C4", value: Math.max(0, progress.savingsActual) },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-(--color-text)">Suas metas este mês</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Renda de referência:{" "}
            <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(progress.income)}</span>
          </p>
        </div>
        <Link href="/metas?recalcular=1">
          <Button type="button" variant="secondary">
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
            Recalcular metas
          </Button>
        </Link>
      </div>

      <CategoryDonutChart data={donutData} />

      <Card>
        <h3 className="font-display text-base font-semibold text-(--color-text)">Gasto por grupo vs. meta</h3>
        <ul className="mt-4 flex flex-col gap-4">
          {progress.categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const share = category.limitAmount > 0 ? (category.spent / category.limitAmount) * 100 : 0;
            const isOver = share >= 100;
            const isNear = share >= 80 && !isOver;
            return (
              <li key={category.categoryId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-(--color-text)">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {category.name}
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        category.bucket === "necessidade"
                          ? "bg-(--color-success)/10 text-(--color-success)"
                          : "bg-(--color-danger)/10 text-(--color-danger)"
                      )}
                    >
                      {category.bucket === "necessidade" ? "Necessidade" : "Desejo"}
                    </span>
                  </span>
                  <span className="text-xs text-(--color-text-muted)">
                    <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(category.spent)}</span> de{" "}
                    {formatCurrency(category.limitAmount)}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--color-border)/60">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      isOver ? "bg-(--color-danger)" : isNear ? "bg-(--color-accent)" : "bg-(--color-primary)"
                    )}
                    style={{ width: `${Math.min(100, share)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
