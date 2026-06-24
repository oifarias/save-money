"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Sparkles, Target, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency } from "@/lib/format";
import type { MockCategory, MockWish } from "@/lib/wish-mock-data";

type WishPreviewCardProps = {
  wish: MockWish;
  position: number;
  category: MockCategory;
  subcategory: MockCategory["children"][number];
  draggable: boolean;
};

function renderSubcategoryIcon(icon: string) {
  const Icon = getCategoryIcon(icon);
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

export function WishPreviewCard({ wish, position, category, subcategory, draggable }: WishPreviewCardProps) {
  const sortable = useSortable({ id: wish.id, disabled: !draggable });

  const style = draggable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
    : undefined;

  const progressPercent = wish.goal ? Math.min(100, (wish.goal.currentAmount / wish.goal.targetAmount) * 100) : 0;

  return (
    <div ref={draggable ? sortable.setNodeRef : undefined} style={style}>
    <Card className={`flex flex-col gap-3 ${sortable.isDragging ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {draggable && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            aria-label="Arrastar para reordenar"
            className="mt-1 flex h-6 w-6 shrink-0 cursor-grab items-center justify-center text-(--color-text-muted) hover:text-(--color-text) active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-bg) text-xs font-semibold text-(--color-text-muted)">
          {position}
        </span>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${subcategory.color}1F`, color: subcategory.color }}
        >
          {renderSubcategoryIcon(subcategory.icon)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-(--color-text)">{wish.name}</p>
          <p className="text-xs text-(--color-text-muted)">
            {category.name} · {subcategory.name}
          </p>
        </div>
        <p className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
          {formatCurrency(wish.estimatedAmount)}
        </p>
      </div>

      {wish.goal ? (
        <div className="flex flex-col gap-1.5 pl-[3.25rem]">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-(--color-bg)">
            <div
              className="h-full rounded-full bg-(--color-primary) transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-(--color-text-muted)">
            {formatCurrency(wish.goal.currentAmount)} de {formatCurrency(wish.goal.targetAmount)} guardados
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 pl-[3.25rem] text-xs font-medium text-(--color-primary)">
          <Target className="h-3.5 w-3.5" aria-hidden="true" />
          Sem plano de economia ainda
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pl-[3.25rem]">
        {wish.cashTimelineLabel && (
          <span className="inline-flex items-center gap-1 rounded-full bg-(--color-success)/10 px-2.5 py-1 text-xs font-medium text-(--color-success)">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {wish.cashTimelineLabel}
          </span>
        )}

        <Link
          href="/metas"
          className="inline-flex items-center gap-1 rounded-full border border-(--color-border) px-2.5 py-1 text-xs font-medium text-(--color-text-muted) hover:border-(--color-primary) hover:text-(--color-text)"
        >
          <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
          {category.budget
            ? `${category.name}: ${formatCurrency(category.budget.spent)}/${formatCurrency(category.budget.limitAmount)} este mês`
            : `Configurar orçamento de ${category.name}`}
        </Link>
      </div>
    </Card>
    </div>
  );
}
