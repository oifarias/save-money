"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, PiggyBank } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import { getDefaultBucket, BUCKET_OPTIONS, type Bucket } from "@/lib/budget-buckets";

type AllocationStepProps = {
  income: number;
  categories: { id: string; name: string; color: string; icon: string }[];
  initialBuckets?: Record<string, Bucket>;
  onConfirmed: (buckets: Record<string, Bucket>) => void;
  onBack: () => void;
};

export function AllocationStep({ income, categories, initialBuckets, onConfirmed, onBack }: AllocationStepProps) {
  const [buckets, setBuckets] = useState<Record<string, Bucket>>(() => {
    const initial: Record<string, Bucket> = {};
    for (const category of categories) {
      initial[category.id] = initialBuckets?.[category.id] ?? getDefaultBucket(category.name);
    }
    return initial;
  });

  const necessidadeValue = income * 0.5;
  const desejoValue = income * 0.3;
  const poupancaValue = income * 0.2;
  const NecessidadeIcon = BUCKET_OPTIONS[0].icon;
  const DesejoIcon = BUCKET_OPTIONS[1].icon;

  function toggleBucket(categoryId: string, bucket: Bucket) {
    setBuckets((current) => ({ ...current, [categoryId]: bucket }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Sugestão de divisão da sua renda</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Baseado na regra 50/30/20 — um ponto de partida, não uma obrigação. Você pode ajustar os valores no próximo
          passo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="flex flex-col gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-primary)/10 text-(--color-primary)">
            <NecessidadeIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Necessidades · 50%</p>
          <p className="font-numeric text-lg font-semibold text-(--color-text)">{formatCurrency(necessidadeValue)}</p>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-danger)/10 text-(--color-danger)">
            <DesejoIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Desejos · 30%</p>
          <p className="font-numeric text-lg font-semibold text-(--color-text)">{formatCurrency(desejoValue)}</p>
        </Card>
        <Card className="flex flex-col gap-1 border-(--color-accent)/30 bg-(--color-accent)/5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--color-accent)/15 text-(--color-accent)">
            <PiggyBank className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-(--color-accent)">Prioridades financeiras · 20%</p>
          <p className="font-numeric text-lg font-semibold text-(--color-text)">{formatCurrency(poupancaValue)}</p>
          <p className="text-xs text-(--color-text-muted)">Reservado pra poupança/investimento — não é alocado em nenhum grupo</p>
        </Card>
      </div>

      <div>
        <p className="text-sm font-medium text-(--color-text)">Classifique seus grupos</p>
        <p className="mt-0.5 text-xs text-(--color-text-muted)">
          Já marcamos uma sugestão — ajuste se algum grupo for diferente pra você (ex.: Educação pode ser uma
          necessidade dependendo da sua situação).
        </p>

        <ul className="mt-3 flex flex-col gap-2">
          {categories.map((category) => {
            const Icon = getCategoryIcon(category.icon);
            const bucket = buckets[category.id];
            return (
              <li
                key={category.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) p-3"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium text-(--color-text)">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${category.color}1F`, color: category.color }}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {category.name}
                </span>
                <div className="flex shrink-0 gap-1.5">
                  {BUCKET_OPTIONS.map((option) => {
                    const OptionIcon = option.icon;
                    const isActive = bucket === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => toggleBucket(category.id, option.value)}
                        aria-pressed={isActive}
                        title={option.label}
                        aria-label={option.label}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-200",
                          isActive
                            ? "border-transparent text-white"
                            : "border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:border-(--color-text-muted)"
                        )}
                        style={isActive ? { backgroundColor: option.color } : undefined}
                      >
                        <OptionIcon className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[10px] font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="button" onClick={() => onConfirmed(buckets)}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
