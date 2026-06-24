"use client";

import { useState } from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle2, ExternalLink, GripVertical, Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency, monthLabel } from "@/lib/format";
import type { WishSummary } from "@/lib/wish-data";
import { WishMilestoneToast } from "@/components/wishes/wish-milestone-toast";
import { WishPurchaseModal } from "@/components/wishes/wish-purchase-modal";
import { PAYMENT_METHOD_LABELS, PURCHASE_TIMING_LABELS, WISH_KIND_OPTIONS } from "@/lib/wish-labels";

const MILESTONES = [25, 50, 75];

function renderSubcategoryIcon(icon: string) {
  const Icon = getCategoryIcon(icon);
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

function cashTimelineLabel(wish: WishSummary): string | null {
  const readiness = wish.readiness;
  if (!readiness) return null;
  if (readiness.cashTimeline === "now") return "Pode comprar à vista este mês";
  if (readiness.cashTimeline === "future" && readiness.cashAvailableMonthKey) {
    const date = new Date(`${readiness.cashAvailableMonthKey}-01`);
    return `Pode comprar à vista em ${monthLabel(date)}`;
  }
  return null;
}

type WishCardProps = {
  wish: WishSummary;
  position?: number;
  draggable?: boolean;
};

export function WishCard({ wish, position, draggable = false }: WishCardProps) {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const sortable = useSortable({ id: wish.id, disabled: !draggable });

  const style = draggable
    ? { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
    : undefined;

  const progressPercent = wish.goal?.progressPercent ?? 0;
  const timelineLabel = cashTimelineLabel(wish);
  const kindOption = WISH_KIND_OPTIONS.find((option) => option.value === wish.kind)!;
  const KindIcon = kindOption.icon;

  const remaining = wish.goal ? Math.max(0, wish.estimatedAmount - wish.goal.currentAmount) : wish.estimatedAmount;
  const accumulated = wish.goal?.currentAmount ?? 0;
  const gapFocus = progressPercent < 60;

  return (
    <div ref={draggable ? sortable.setNodeRef : undefined} style={style}>
      {wish.goal && <WishMilestoneToast wishId={wish.id} wishName={wish.name} progressPercent={progressPercent} />}
      <Card className={`flex flex-col gap-4 transition-shadow hover:shadow-md ${sortable.isDragging ? "opacity-60" : ""}`}>
        <Link href={`/desejos/${wish.id}`} className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {draggable && (
                <button
                  type="button"
                  {...sortable.attributes}
                  {...sortable.listeners}
                  onClick={(event) => event.preventDefault()}
                  aria-label="Arrastar para reordenar"
                  className="mt-1 flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-(--color-text-muted) hover:text-(--color-text) active:cursor-grabbing"
                >
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {position !== undefined && (
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-bg) text-xs font-semibold text-(--color-text-muted)">
                  {position}
                </span>
              )}
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

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ backgroundColor: `${kindOption.color}1F`, color: kindOption.color }}
            >
              <KindIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {kindOption.label}
            </span>

            {timelineLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-(--color-success)/10 px-2.5 py-1 text-xs font-medium text-(--color-success)">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {timelineLabel}
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-full border border-(--color-border) px-2.5 py-1 text-xs font-medium text-(--color-text-muted)">
              {PURCHASE_TIMING_LABELS[wish.purchaseTiming]}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-(--color-border) px-2.5 py-1 text-xs font-medium text-(--color-text-muted)">
              {wish.paymentMethod === "INSTALLMENTS" && wish.installmentsCount && wish.installmentAmount
                ? `${wish.installmentsCount}x de ${formatCurrency(wish.installmentAmount)}`
                : PAYMENT_METHOD_LABELS.CASH}
            </span>

            {wish.link && (
              <a
                href={wish.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1 rounded-full border border-(--color-border) px-2.5 py-1 text-xs font-medium text-(--color-text-muted) hover:border-(--color-primary) hover:text-(--color-text)"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Ver item
              </a>
            )}
          </div>
        </Link>

        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setPurchaseOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-(--color-success)/30 bg-(--color-success)/10 px-3.5 py-2 text-xs font-medium text-(--color-success) transition-colors hover:bg-(--color-success)/20 cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Marcar como comprado
        </button>
      </Card>

      <WishPurchaseModal
        open={purchaseOpen}
        wishId={wish.id}
        wishName={wish.name}
        estimatedAmount={wish.estimatedAmount}
        onClose={() => setPurchaseOpen(false)}
      />
    </div>
  );
}
