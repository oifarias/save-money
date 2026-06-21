"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Download, Loader2, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import {
  TransactionForm,
  type TransactionFormCategory,
  type TransactionFormValues,
} from "@/components/transactions/transaction-form";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { PeriodFilter } from "@/components/transactions/period-filter";
import { BulkEditForm } from "@/components/transactions/bulk-edit-form";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import { toInputDate } from "@/lib/format";
import { deleteTransactionAction, loadMoreTransactionsAction } from "@/app/(app)/lancamentos/actions";

type TransactionsSummary = {
  income: number;
  expense: number;
  balance: number;
  fixedExpense: number;
  periodLabel: string;
};

type TransactionsManagerProps = {
  transactions: TransactionListItem[];
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  totalCount: number;
  pageSize: number;
  summary: TransactionsSummary;
};

const ADVANCED_FILTER_KEYS = ["categoryId", "subcategoryId", "description", "amountOperator", "month"];

export function TransactionsManager({
  transactions,
  categories,
  tagSuggestions,
  totalCount,
  pageSize,
  summary,
}: TransactionsManagerProps) {
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeAdvancedFilterCount = ADVANCED_FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [deleting, setDeleting] = useState<TransactionListItem | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState(transactions);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(transactions.length < totalCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filtersKey = searchParams.toString();
  const [previousFiltersKey, setPreviousFiltersKey] = useState(filtersKey);

  if (filtersKey !== previousFiltersKey) {
    setPreviousFiltersKey(filtersKey);
    setSelectedIds(new Set());
    setItems(transactions);
    setNextPage(2);
    setHasMore(transactions.length < totalCount);
  }

  useEffect(() => {
    if (!selectAllRef.current) return;
    const visibleSelectedCount = items.filter((t) => selectedIds.has(t.id)).length;
    selectAllRef.current.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < items.length;
  }, [selectedIds, items]);

  function loadMore() {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    startTransition(async () => {
      try {
        const more = await loadMoreTransactionsAction(filtersKey, nextPage);
        setItems((prev) => [...prev, ...more]);
        setHasMore(more.length === pageSize);
        setNextPage((p) => p + 1);
      } catch {
        toast.error("Não foi possível carregar mais lançamentos");
      } finally {
        setIsLoadingMore(false);
      }
    });
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, nextPage, filtersKey]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: TransactionListItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const result = await deleteTransactionAction(deleting.id);
      if (result.success) {
        toast.success(result.message ?? "Lançamento excluído");
      } else {
        toast.error(result.message ?? "Não foi possível excluir o lançamento");
      }
      setDeleting(null);
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allVisibleSelected = items.every((t) => prev.has(t.id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        items.forEach((t) => next.delete(t.id));
        return next;
      }
      const next = new Set(prev);
      items.forEach((t) => next.add(t.id));
      return next;
    });
  }

  function closeBulkEdit() {
    setBulkEditOpen(false);
    setSelectedIds(new Set());
  }

  const editingValues: TransactionFormValues | undefined = editing
    ? {
        id: editing.id,
        type: editing.type,
        date: toInputDate(editing.date),
        description: editing.description,
        amount: String(editing.amount),
        categoryId: editing.category?.id ?? "",
        subcategoryId: editing.subcategory?.id ?? "",
        isFixed: editing.isFixed,
        recurrence: editing.recurrence,
        tags: editing.tags,
      }
    : undefined;

  const selectedCount = selectedIds.size;
  const exportHref = filtersKey ? `/api/export/transactions?${filtersKey}` : "/api/export/transactions";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-text)">Lançamentos</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">Registre e acompanhe suas entradas e despesas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo lançamento
        </Button>
      </div>

      <SummaryCards
        income={summary.income}
        expense={summary.expense}
        balance={summary.balance}
        fixedExpense={summary.fixedExpense}
        periodLabel={summary.periodLabel}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-label="Filtros"
            title="Filtros"
            className="px-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeAdvancedFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-semibold text-white">
                {activeAdvancedFilterCount}
              </span>
            )}
          </Button>
          <a
            href={exportHref}
            aria-label="Baixar Excel"
            title="Baixar Excel"
            className="inline-flex items-center justify-center rounded-lg p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      {filtersOpen && <TransactionFiltersBar categories={categories} />}

      {selectedCount > 0 && (
        <div
          aria-live="polite"
          className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3"
        >
          <p className="text-sm font-medium text-(--color-text)">{selectedCount} selecionado(s)</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
            <Button type="button" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar em lote
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum lançamento encontrado</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Ajuste os filtros ou registre um novo lançamento para começar.
          </p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar lançamento
          </Button>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-(--color-border) p-0">
            <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={items.length > 0 && items.every((t) => selectedIds.has(t.id))}
                onChange={toggleSelectAllVisible}
                aria-label="Selecionar todos os lançamentos carregados"
                className="h-4 w-4 shrink-0 rounded border-(--color-border) accent-(--color-primary)"
              />
              <span className="text-xs text-(--color-text-muted)">Selecionar todos os carregados</span>
            </div>
            {items.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onEdit={openEdit}
                onDelete={setDeleting}
                selectable
                selected={selectedIds.has(transaction.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </Card>

          <div className="flex flex-col items-center gap-2 py-2">
            <p className="text-xs text-(--color-text-muted)">
              Mostrando {items.length} de {totalCount} lançamento(s)
            </p>
            {hasMore ? (
              <div ref={sentinelRef} className="flex items-center gap-2 text-xs text-(--color-text-muted)">
                {isLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                Carregando mais lançamentos…
              </div>
            ) : (
              <p className="text-xs text-(--color-text-muted)">Você viu todos os lançamentos do período.</p>
            )}
          </div>
        </>
      )}

      <Modal open={formOpen} title={editing ? "Editar lançamento" : "Novo lançamento"} onClose={closeForm}>
        <TransactionForm
          categories={categories}
          tagSuggestions={tagSuggestions}
          transaction={editingValues}
          onDone={closeForm}
        />
      </Modal>

      <Modal open={bulkEditOpen} title={`Editar ${selectedCount} lançamentos selecionados`} onClose={closeBulkEdit}>
        <BulkEditForm ids={Array.from(selectedIds)} categories={categories} onDone={closeBulkEdit} />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir lançamento"
        description={`Tem certeza que deseja excluir "${deleting?.description}"? Essa ação não pode ser desfeita.`}
        isLoading={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
