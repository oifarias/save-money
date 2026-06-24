"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DndContext, type DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Gift, Layers, ListOrdered, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCategoryIcon } from "@/lib/category-icons";
import type { WishSummary } from "@/lib/wish-data";
import { WishCard } from "@/components/wishes/wish-card";
import { WishIntake } from "@/components/wishes/wish-intake";
import { WishBatchModal } from "@/components/wishes/wish-batch-modal";
import { WishBulkModal } from "@/components/wishes/wish-bulk-modal";
import { reorderWishesAction } from "@/app/(app)/desejos/actions";
import type { WishFormCategory } from "@/components/wishes/wish-batch-modal";
import { WISH_KIND_OPTIONS } from "@/lib/wish-labels";
import type { WishKind } from "@/generated/prisma/client";

type CollapsibleHistoryProps = {
  id: string;
  title: string;
  emptyHint: string;
  items: WishSummary[];
  renderBadge: (wish: WishSummary) => React.ReactNode;
};

function CollapsibleHistory({ id, title, emptyHint, items, renderBadge }: CollapsibleHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">{title}</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="font-display text-lg font-semibold text-(--color-text)">
          {title} <span className="text-sm font-normal text-(--color-text-muted)">({items.length})</span>
        </h2>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        id={id}
        className={`overflow-hidden transition-all duration-200 ${expanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <Card className="divide-y divide-(--color-border) p-0">
          {items.map((wish) => {
            const Icon = getCategoryIcon(wish.subcategory.icon);
            return (
              <div key={wish.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${wish.subcategory.color}1F`, color: wish.subcategory.color }}
                >
                  <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-text)">{wish.name}</p>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">{renderBadge(wish)}</p>
                </div>
                <span className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
                  {formatCurrency(wish.estimatedAmount)}
                </span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

type GroupMode = "priority" | "category";

type WishesManagerProps = {
  active: WishSummary[];
  purchased: WishSummary[];
  abandoned: WishSummary[];
  categories: WishFormCategory[];
};

export function WishesManager({ active, purchased, abandoned, categories }: WishesManagerProps) {
  const router = useRouter();
  const [batchOpen, setBatchOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<WishKind | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("priority");
  const [orderedActive, setOrderedActive] = useState(active);
  const [, startTransition] = useTransition();
  const [dndReady, setDndReady] = useState(false);

  useEffect(() => {
    // dnd-kit gera ids internos (aria-describedby) que divergem entre SSR e a primeira hidratação —
    // habilita o drag-and-drop só depois do mount no cliente para evitar o mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDndReady(true);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const hasAnyWish = active.length > 0 || purchased.length > 0 || abandoned.length > 0;

  const categoryFiltered = useMemo(
    () => orderedActive.filter((wish) => !categoryFilter || wish.category.id === categoryFilter),
    [orderedActive, categoryFilter]
  );

  const kindSummary = useMemo(() => {
    const needs = categoryFiltered.filter((wish) => wish.kind === "NEED");
    const wants = categoryFiltered.filter((wish) => wish.kind === "WANT");
    return {
      NEED: { count: needs.length, total: needs.reduce((sum, wish) => sum + wish.estimatedAmount, 0) },
      WANT: { count: wants.length, total: wants.reduce((sum, wish) => sum + wish.estimatedAmount, 0) },
    };
  }, [categoryFiltered]);

  const filtered = useMemo(
    () => categoryFiltered.filter((wish) => !kindFilter || wish.kind === kindFilter),
    [categoryFiltered, kindFilter]
  );

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, WishSummary[]>();
    for (const wish of filtered) {
      const list = groups.get(wish.category.id) ?? [];
      list.push(wish);
      groups.set(wish.category.id, list);
    }
    return groups;
  }, [filtered]);

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    const ids = filtered.map((wish) => wish.id);
    const oldIndex = ids.indexOf(String(dragged.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedIds = arrayMove(ids, oldIndex, newIndex);
    const reorderedSet = new Set(reorderedIds);

    setOrderedActive((current) => {
      const untouched = current.filter((wish) => !reorderedSet.has(wish.id));
      const reordered = reorderedIds.map((id) => current.find((wish) => wish.id === id)!);
      return [...reordered, ...untouched].sort((a, b) => {
        const aIndex = reorderedIds.indexOf(a.id);
        const bIndex = reorderedIds.indexOf(b.id);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      });
    });

    startTransition(async () => {
      await reorderWishesAction({ wishIds: reorderedIds });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Lista de compras</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Cadastre os itens que você deseja comprar para se organizar financeiramente da melhor forma — acompanhe
          prioridades, valores e quando cada compra cabe no seu orçamento.
        </p>
      </div>

      <WishIntake onIndividual={() => setBatchOpen(true)} onBulk={() => setBulkOpen(true)} />

      {!hasAnyWish ? (
        <Card className="flex flex-col items-center gap-2 py-14 text-center">
          <Gift className="h-8 w-8 text-(--color-text-muted)" aria-hidden="true" />
          <p className="font-display text-lg font-semibold text-(--color-text)">Ainda não há itens cadastrados</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Cadastre algo que você quer comprar — de uma besteira a um item mais caro — e a gente te ajuda a
            acompanhar o progresso até a hora de realizar.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WISH_KIND_OPTIONS.map((option) => {
              const Icon = option.icon;
              const summary = kindSummary[option.value];
              const isActive = kindFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKindFilter((current) => (current === option.value ? null : option.value))}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    isActive
                      ? "border-(--color-primary) bg-(--color-primary)/10"
                      : "border-(--color-border) bg-(--color-surface) hover:border-(--color-primary)/40"
                  }`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${option.color}1F`, color: option.color }}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-(--color-text)">{option.label}s</p>
                    <p className="text-xs text-(--color-text-muted)">
                      {summary.count} item{summary.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="shrink-0 font-numeric text-base font-semibold text-(--color-text)">
                    {formatCurrency(summary.total)}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-(--color-text-muted)">Filtrar por grupo</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
              >
                <option value="">Todos os grupos</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 rounded-xl border border-(--color-border) p-1">
              <button
                type="button"
                onClick={() => setGroupMode("priority")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  groupMode === "priority" ? "bg-(--color-primary)/10 text-(--color-primary)" : "text-(--color-text-muted)"
                }`}
              >
                <ListOrdered className="h-3.5 w-3.5" aria-hidden="true" />
                Ordem de prioridade
              </button>
              <button
                type="button"
                onClick={() => setGroupMode("category")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  groupMode === "category" ? "bg-(--color-primary)/10 text-(--color-primary)" : "text-(--color-text-muted)"
                }`}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Agrupar por grupo
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 py-10 text-center">
              <Gift className="h-7 w-7 text-(--color-text-muted)" aria-hidden="true" />
              <p className="text-sm text-(--color-text-muted)">Nenhum item ativo com esse filtro.</p>
            </Card>
          ) : groupMode === "priority" && dndReady ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map((wish) => wish.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((wish, index) => (
                    <WishCard key={wish.id} wish={wish} position={index + 1} draggable />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : groupMode === "priority" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((wish, index) => (
                <WishCard key={wish.id} wish={wish} position={index + 1} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {Array.from(groupedByCategory.entries()).map(([categoryId, items]) => {
                const categoryName = items[0]?.category.name ?? "";
                return (
                  <div key={categoryId} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-(--color-text-muted)" aria-hidden="true" />
                      <h2 className="font-display text-base font-semibold text-(--color-text)">{categoryName}</h2>
                      <span className="text-xs text-(--color-text-muted)">({items.length})</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map((wish) => (
                        <WishCard key={wish.id} wish={wish} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <CollapsibleHistory
            id="wishes-purchased-history"
            title="Comprados"
            emptyHint="Ainda não há itens concluídos."
            items={purchased}
            renderBadge={(wish) => (wish.purchasedAt ? `Comprado em ${formatDate(wish.purchasedAt)}` : "Comprado")}
          />

          <CollapsibleHistory
            id="wishes-abandoned-history"
            title="Histórico de prioridades mudadas"
            emptyHint="Nenhum item foi deixado de lado até agora."
            items={abandoned}
            renderBadge={(wish) => (
              <span className="flex items-center gap-1">
                <XCircle className="h-3 w-3" aria-hidden="true" />
                {wish.abandonedAt ? `Em ${formatDate(wish.abandonedAt)}` : "Prioridade mudou"}
              </span>
            )}
          />
        </>
      )}

      <WishBatchModal
        open={batchOpen}
        categories={categories}
        onClose={() => setBatchOpen(false)}
        onAdded={() => router.refresh()}
      />
      <WishBulkModal
        open={bulkOpen}
        categories={categories}
        onClose={() => setBulkOpen(false)}
        onAdded={() => router.refresh()}
      />
    </div>
  );
}
