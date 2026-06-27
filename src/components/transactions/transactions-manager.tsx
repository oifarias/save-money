"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, Download, Loader2, Pencil, Trash2 } from "lucide-react";
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
import { FiltersPanel } from "@/components/transactions/filters-panel";
import { BulkEditForm } from "@/components/transactions/bulk-edit-form";
import { ShareSplitButton } from "@/components/split/share-split-button";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import { toInputDate } from "@/lib/format";
import { bulkDeleteTransactionsAction, deleteTransactionAction, loadMoreTransactionsAction } from "@/app/(app)/lancamentos/actions";
import type { FixedExpenseTemplatesTotals, IncomeBreakdown, ExpenseBreakdown } from "@/lib/dashboard-data";

type TransactionsSummary = {
  income: number;
  expense: number;
  fixedExpenseTemplates: FixedExpenseTemplatesTotals;
  incomeBreakdown: IncomeBreakdown;
  expenseBreakdown: ExpenseBreakdown;
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

export function TransactionsManager({
  transactions,
  categories,
  tagSuggestions,
  totalCount,
  pageSize,
  summary,
}: TransactionsManagerProps) {
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [deleting, setDeleting] = useState<TransactionListItem | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isDashboardFilter = searchParams.has("type") || searchParams.has("isFixed") || searchParams.has("installment");
  const [summaryExpanded, setSummaryExpanded] = useState(!isDashboardFilter);
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState(transactions);
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(transactions.length < totalCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const filtersKey = searchParams.toString();

  // Assinatura da primeira página vinda do servidor: muda quando um lançamento é criado, editado ou excluído
  // (via revalidatePath nas Server Actions), mesmo sem o usuário trocar nenhum filtro.
  const transactionsSignature = transactions
    .map((t) => `${t.id}:${t.amount}:${t.description}:${t.category?.id ?? ""}:${t.subcategory?.id ?? ""}:${t.date}`)
    .join("|");
  const resetKey = `${filtersKey}::${transactionsSignature}`;
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);

  if (resetKey !== previousResetKey) {
    setPreviousResetKey(resetKey);
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

  function confirmBulkDelete() {
    startTransition(async () => {
      const result = await bulkDeleteTransactionsAction([...selectedIds]);
      if (result.success) {
        toast.success(result.message ?? "Lançamentos excluídos");
        setSelectedIds(new Set());
      } else {
        toast.error(result.message ?? "Não foi possível excluir os lançamentos");
      }
      setBulkDeleteOpen(false);
    });
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
    <div id="lancamentos-realizados" className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setSummaryExpanded((current) => !current)}
        aria-expanded={summaryExpanded}
        aria-controls="lancamentos-realizados-summary"
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="font-display text-xl font-semibold text-(--color-text)">Lançamentos realizados</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">Acompanhe, filtre e edite o que já foi lançado</p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200 ${summaryExpanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        id="lancamentos-realizados-summary"
        className={`overflow-hidden transition-all duration-200 ${summaryExpanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <SummaryCards
          income={summary.income}
          expense={summary.expense}
          fixedExpenseTemplates={summary.fixedExpenseTemplates}
          incomeBreakdown={summary.incomeBreakdown}
          expenseBreakdown={summary.expenseBreakdown}
          installments={{ currentMonth: 0, currentMonthCount: 0, remaining: 0, lastInstallmentPlansCount: 0, lastInstallmentAmount: 0 }}
          periodLabel={summary.periodLabel}
          filterParams={searchParams}
        />
      </div>

      <FiltersPanel
        categories={categories}
        actions={
          <a
            href={exportHref}
            aria-label="Baixar Excel"
            title="Baixar Excel"
            className="inline-flex items-center justify-center rounded-lg p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </a>
        }
      />

      {selectedCount > 0 && (
        <div
          aria-live="polite"
          className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3"
        >
          <p className="text-sm font-medium text-(--color-text)">{selectedCount} selecionado(s)</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Limpar seleção
            </Button>
            <ShareSplitButton
              transactions={items.filter((t) => selectedIds.has(t.id))}
              onDone={() => setSelectedIds(new Set())}
            />
            <Button type="button" onClick={() => setBulkEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Editar em lote
            </Button>
            <Button type="button" variant="danger" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum lançamento encontrado</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Ajuste os filtros ou registre um lançamento na seção &quot;Novo lançamento&quot;, acima.
          </p>
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

      <Modal open={formOpen} title="Editar lançamento" onClose={closeForm}>
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

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Excluir ${selectedCount} lançamento(s)`}
        description={`Tem certeza que deseja excluir os ${selectedCount} lançamentos selecionados? Lançamentos parcelados terão todas as parcelas removidas. Essa ação não pode ser desfeita.`}
        isLoading={isPending}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
