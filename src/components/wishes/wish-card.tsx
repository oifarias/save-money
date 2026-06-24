"use client";

import Link from "next/link";
import { Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import type { WishSummary } from "@/lib/wish-data";
import { WishMilestoneToast } from "@/components/wishes/wish-milestone-toast";

const MILESTONES = [25, 50, 75];

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function renderSubcategoryIcon(icon: string) {
  const Icon = getCategoryIcon(icon);
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

export function WishCard({ wish }: { wish: WishSummary }) {
  const progressPercent = wish.goal?.progressPercent ?? 0;
  const inCoolingOff = Boolean(wish.coolingOffUntil) && new Date(wish.coolingOffUntil as string) > new Date();
  const canAfford = wish.readiness?.canAfford && !inCoolingOff;

  const remaining = wish.goal ? Math.max(0, wish.estimatedAmount - wish.goal.currentAmount) : wish.estimatedAmount;
  const accumulated = wish.goal?.currentAmount ?? 0;
  const gapFocus = progressPercent < 60;

  return (
    <>
      {wish.goal && <WishMilestoneToast wishId={wish.id} wishName={wish.name} progressPercent={progressPercent} />}
      <Link href={`/desejos/${wish.id}`}>
        <Card className="flex flex-col gap-4 transition-shadow hover:shadow-md">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${wish.subcategory.color}1F`, color: wish.subcategory.color }}
              >
                {renderSubcategoryIcon(wish.subcategory.icon)}
              </span>
              <div>
                <p className="font-medium text-(--color-text)">{wish.name}</p>
                <p className="text-xs text-(--color-text-muted)">
                  {wish.category.name} · {wish.subcategory.name}
                </p>
              </div>
            </div>
            <p className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
              {formatCurrency(wish.estimatedAmount)}
            </p>
          </div>

          {wish.goal ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={gapFocus ? "font-semibold text-(--color-text)" : "text-(--color-text-muted)"}>
                  {gapFocus
                    ? `Faltam ${formatCurrency(remaining)}`
                    : `Você já tem ${formatCurrency(accumulated)}`}
                </span>
                <span className="text-(--color-text-muted)">{Math.round(progressPercent)}%</span>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-(--color-bg)">
                <div
                  className="h-full rounded-full bg-(--color-primary) transition-all duration-300"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
                {MILESTONES.map((milestone) => (
                  <span
                    key={milestone}
                    className="absolute top-0 h-2.5 w-px bg-(--color-surface)/70"
                    style={{ left: `${milestone}%` }}
                    aria-hidden="true"
                  />
                ))}
              </div>
              {!gapFocus && (
                <p className="text-xs text-(--color-text-muted)">Faltam {formatCurrency(remaining)}</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-(--color-border) px-3 py-2.5">
              <p className="text-xs text-(--color-text-muted)">Sem plano de economia ainda</p>
              <span className="flex items-center gap-1 text-xs font-medium text-(--color-primary)">
                <Target className="h-3.5 w-3.5" aria-hidden="true" />
                Definir estratégia
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {canAfford && (
              <span className="inline-flex items-center gap-1 rounded-full bg-(--color-success)/10 px-2.5 py-1 text-xs font-medium text-(--color-success)">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Pode comprar!
              </span>
            )}
            {inCoolingOff && (
              <span className="inline-flex items-center rounded-full bg-(--color-accent)/10 px-2.5 py-1 text-xs font-medium text-(--color-accent)">
                Disponível em {daysUntil(wish.coolingOffUntil as string)} dia
                {daysUntil(wish.coolingOffUntil as string) > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </Card>
      </Link>
    </>
  );
}
