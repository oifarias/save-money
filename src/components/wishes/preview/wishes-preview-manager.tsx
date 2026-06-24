"use client";

import { useId, useMemo, useState } from "react";
import { DndContext, type DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, Heart, Layers, ListOrdered, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { MOCK_CATEGORIES, MOCK_WISHES, type MockWish, type MockWishKind } from "@/lib/wish-mock-data";
import { WishPreviewCard } from "@/components/wishes/preview/wish-preview-card";
import { WishPreviewAddModal, type WishPreviewAddInput } from "@/components/wishes/preview/wish-preview-add-modal";
import { WishPreviewBulkModal } from "@/components/wishes/preview/wish-preview-bulk-modal";
import { WishPreviewIntake } from "@/components/wishes/preview/wish-preview-intake";

type GroupMode = "priority" | "category";

export function WishesPreviewManager() {
  const [wishes, setWishes] = useState<MockWish[]>(MOCK_WISHES);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<MockWishKind | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("priority");
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const filterId = useId();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const categoryFiltered = useMemo(
    () =>
      wishes
        .filter((wish) => wish.status === "ACTIVE")
        .filter((wish) => !categoryFilter || wish.categoryId === categoryFilter),
    [wishes, categoryFilter]
  );

  const kindSummary = useMemo(() => {
    const needs = categoryFiltered.filter((wish) => wish.kind === "need");
    const wants = categoryFiltered.filter((wish) => wish.kind === "want");
    return {
      need: { count: needs.length, total: needs.reduce((sum, wish) => sum + wish.estimatedAmount, 0) },
      want: { count: wants.length, total: wants.reduce((sum, wish) => sum + wish.estimatedAmount, 0) },
    };
  }, [categoryFiltered]);

  const active = useMemo(
    () =>
      categoryFiltered
        .filter((wish) => !kindFilter || wish.kind === kindFilter)
        .sort((a, b) => a.priority - b.priority),
    [categoryFiltered, kindFilter]
  );

  const categoryOf = (id: string) => MOCK_CATEGORIES.find((category) => category.id === id)!;
  const subcategoryOf = (categoryId: string, id: string) => categoryOf(categoryId).children.find((sub) => sub.id === id)!;

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;

    setWishes((current) => {
      const activeIds = active.map((wish) => wish.id);
      const oldIndex = activeIds.indexOf(String(dragged.id));
      const newIndex = activeIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return current;

      const reorderedIds = arrayMove(activeIds, oldIndex, newIndex);
      const priorityById = new Map(reorderedIds.map((id, index) => [id, index + 1]));

      return current.map((wish) => (priorityById.has(wish.id) ? { ...wish, priority: priorityById.get(wish.id)! } : wish));
    });
  }

  function handleAdd(inputs: WishPreviewAddInput[]) {
    const baseMax = Math.max(0, ...wishes.filter((w) => w.status === "ACTIVE").map((w) => w.priority));
    setWishes((current) => [
      ...current,
      ...inputs.map((input, index) => ({
        id: `wish-mock-${Date.now()}-${index}`,
        name: input.name,
        estimatedAmount: input.estimatedAmount,
        link: input.link,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        status: "ACTIVE" as const,
        priority: baseMax + index + 1,
        notes: null,
        goal: null,
        cashTimelineLabel: null,
        purchaseTiming: input.purchaseTiming,
        paymentMethod: input.paymentMethod,
        installmentsCount: input.installmentsCount,
        installmentAmount: input.installmentAmount,
        kind: input.kind,
      })),
    ]);
  }

  function handleAddMany(inputs: { name: string; estimatedAmount: number; categoryId: string; subcategoryId: string }[]) {
    const baseMax = Math.max(0, ...wishes.filter((w) => w.status === "ACTIVE").map((w) => w.priority));
    setWishes((current) => [
      ...current,
      ...inputs.map((input, index) => ({
        id: `wish-mock-bulk-${Date.now()}-${index}`,
        name: input.name,
        estimatedAmount: input.estimatedAmount,
        link: null,
        categoryId: input.categoryId,
        subcategoryId: input.subcategoryId,
        status: "ACTIVE" as const,
        priority: baseMax + index + 1,
        notes: null,
        goal: null,
        cashTimelineLabel: null,
        purchaseTiming: "this_month" as const,
        paymentMethod: "cash" as const,
        installmentsCount: null,
        installmentAmount: null,
        kind: "want" as const,
      })),
    ]);
  }

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, MockWish[]>();
    for (const wish of active) {
      const list = groups.get(wish.categoryId) ?? [];
      list.push(wish);
      groups.set(wish.categoryId, list);
    }
    return groups;
  }, [active]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Desejos (protótipo)</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Tela de validação de UX com dados mockados — nada aqui é persistido.
        </p>
      </div>

      <WishPreviewIntake onIndividual={() => setAddOpen(true)} onBulk={() => setBulkOpen(true)} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setKindFilter((current) => (current === "need" ? null : "need"))}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
            kindFilter === "need"
              ? "border-(--color-primary) bg-(--color-primary)/10"
              : "border-(--color-border) bg-(--color-surface) hover:border-(--color-primary)/40"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-danger)/10 text-(--color-danger)">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-(--color-text)">Necessidades</p>
            <p className="text-xs text-(--color-text-muted)">{kindSummary.need.count} item{kindSummary.need.count === 1 ? "" : "s"}</p>
          </div>
          <p className="shrink-0 font-numeric text-base font-semibold text-(--color-text)">
            {formatCurrency(kindSummary.need.total)}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setKindFilter((current) => (current === "want" ? null : "want"))}
          className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
            kindFilter === "want"
              ? "border-(--color-primary) bg-(--color-primary)/10"
              : "border-(--color-border) bg-(--color-surface) hover:border-(--color-primary)/40"
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
            <Heart className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-(--color-text)">Desejos</p>
            <p className="text-xs text-(--color-text-muted)">{kindSummary.want.count} item{kindSummary.want.count === 1 ? "" : "s"}</p>
          </div>
          <p className="shrink-0 font-numeric text-base font-semibold text-(--color-text)">
            {formatCurrency(kindSummary.want.total)}
          </p>
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={filterId} className="text-xs font-medium text-(--color-text-muted)">
            Filtrar por grupo
          </label>
          <select
            id={filterId}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
          >
            <option value="">Todos os grupos</option>
            {MOCK_CATEGORIES.map((category) => (
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

      {active.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <p className="text-sm text-(--color-text-muted)">Nenhum desejo ativo com esse filtro.</p>
        </Card>
      ) : groupMode === "priority" ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={active.map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {active.map((wish, index) => (
                <WishPreviewCard
                  key={wish.id}
                  wish={wish}
                  position={index + 1}
                  category={categoryOf(wish.categoryId)}
                  subcategory={subcategoryOf(wish.categoryId, wish.subcategoryId)}
                  draggable
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groupedByCategory.entries()).map(([categoryId, items]) => {
            const category = categoryOf(categoryId);
            return (
              <div key={categoryId} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 text-(--color-text-muted)" aria-hidden="true" />
                  <h2 className="font-display text-base font-semibold text-(--color-text)">{category.name}</h2>
                  <span className="text-xs text-(--color-text-muted)">({items.length})</span>
                </div>
                <div className="flex flex-col gap-3">
                  {items.map((wish) => (
                    <WishPreviewCard
                      key={wish.id}
                      wish={wish}
                      position={wish.priority}
                      category={category}
                      subcategory={subcategoryOf(wish.categoryId, wish.subcategoryId)}
                      draggable={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WishPreviewAddModal open={addOpen} categories={MOCK_CATEGORIES} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
      <WishPreviewBulkModal open={bulkOpen} categories={MOCK_CATEGORIES} onClose={() => setBulkOpen(false)} onAddMany={handleAddMany} />
    </div>
  );
}
