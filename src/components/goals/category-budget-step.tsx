"use client";

import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import type { Bucket } from "@/lib/budget-buckets";
import { saveBudgetAllocationAction } from "@/app/(app)/metas/actions";

type CategoryInfo = { id: string; name: string; color: string; icon: string };

type CategoryBudgetStepProps = {
  income: number;
  categories: CategoryInfo[];
  buckets: Record<string, Bucket>;
  categoryAverages: Record<string, number>;
  committedByCategory?: Record<string, number>;
  initialAmounts?: Record<string, number>;
  onSaved: () => void;
  onBack: () => void;
};

function computeDefaultAmounts(
  categories: CategoryInfo[],
  buckets: Record<string, Bucket>,
  categoryAverages: Record<string, number>,
  income: number,
  committedByCategory: Record<string, number>,
  initialAmounts?: Record<string, number>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const bucket of ["necessidade", "desejo"] as const) {
    const bucketCategories = categories.filter((c) => buckets[c.id] === bucket);
    if (bucketCategories.length === 0) continue;

    const target = income * (bucket === "necessidade" ? 0.5 : 0.3);
    const sumAverage = bucketCategories.reduce((sum, c) => sum + (categoryAverages[c.id] ?? 0), 0);

    for (const category of bucketCategories) {
      if (initialAmounts?.[category.id] !== undefined) {
        result[category.id] = String(initialAmounts[category.id]);
        continue;
      }
      const average = categoryAverages[category.id] ?? 0;
      const suggested = sumAverage > 0 ? target * (average / sumAverage) : target / bucketCategories.length;
      const committed = committedByCategory[category.id] ?? 0;
      const amount = Math.max(suggested, committed);
      result[category.id] = amount.toFixed(2);
    }
  }

  return result;
}

const BUCKET_LABELS: Record<Bucket, string> = { necessidade: "Necessidades", desejo: "Desejos" };

export function CategoryBudgetStep({
  income,
  categories,
  buckets,
  categoryAverages,
  committedByCategory,
  initialAmounts,
  onSaved,
  onBack,
}: CategoryBudgetStepProps) {
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    computeDefaultAmounts(categories, buckets, categoryAverages, income, committedByCategory ?? {}, initialAmounts)
  );
  const [isPending, startTransition] = useTransition();

  const totalsByBucket = useMemo(() => {
    const totals: Record<Bucket, number> = { necessidade: 0, desejo: 0 };
    for (const category of categories) {
      const bucket = buckets[category.id];
      const value = Number(amounts[category.id]?.replace(",", ".") ?? 0) || 0;
      totals[bucket] += value;
    }
    return totals;
  }, [amounts, buckets, categories]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const items = categories.map((category) => ({
      categoryId: category.id,
      bucket: buckets[category.id],
      limitAmount: Number(amounts[category.id]?.replace(",", ".") ?? 0) || 0,
    }));

    startTransition(async () => {
      const result = await saveBudgetAllocationAction({ items });
      if (result.success) {
        toast.success(result.message ?? "Metas salvas");
        onSaved();
      } else {
        toast.error(result.message ?? "Não foi possível salvar as metas");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Defina o valor de cada grupo</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Já deixamos um valor sugerido com base no que você costuma gastar. Ajuste como quiser.
        </p>
      </div>

      {(["necessidade", "desejo"] as const).map((bucket) => {
        const bucketCategories = categories.filter((c) => buckets[c.id] === bucket);
        if (bucketCategories.length === 0) return null;
        const target = income * (bucket === "necessidade" ? 0.5 : 0.3);
        const total = totalsByBucket[bucket];
        const overTarget = target > 0 && total > target;

        return (
          <div key={bucket} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-(--color-text)">{BUCKET_LABELS[bucket]}</h3>
              <p className={overTarget ? "text-xs font-medium text-(--color-danger)" : "text-xs text-(--color-text-muted)"}>
                {formatCurrency(total)} de {formatCurrency(target)} sugerido
              </p>
            </div>

            {bucketCategories.map((category) => {
              const Icon = getCategoryIcon(category.icon);
              return (
                <div key={category.id} className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                  >
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <label
                    className="min-w-0 flex-1 truncate text-sm font-medium text-(--color-text)"
                    htmlFor={`amount-${category.id}`}
                    title={category.name}
                  >
                    {category.name}
                  </label>
                  <input
                    id={`amount-${category.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={amounts[category.id] ?? ""}
                    onChange={(event) => setAmounts((current) => ({ ...current, [category.id]: event.target.value }))}
                    className="w-32 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 text-right font-numeric text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                  />
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="submit" isLoading={isPending}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Salvar metas
        </Button>
      </div>
    </form>
  );
}
