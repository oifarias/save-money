"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TransactionForm,
  type TransactionFormCategory,
  type TransactionFormValues,
} from "@/components/transactions/transaction-form";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { BulkEditForm } from "@/components/transactions/bulk-edit-form";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import { toInputDate } from "@/lib/format";
import { deleteTransactionAction } from "@/app/(app)/lancamentos/actions";

type TransactionsManagerProps = {
  transactions: TransactionListItem[];
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export function TransactionsManager({
  transactions,
  categories,
  tagSuggestions,
  totalCount,
  page,
  pageSize,
}: TransactionsManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [deleting, setDeleting] = useState<TransactionListItem | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const selectAllRef = useRef<HTMLInputElement>(null);
  const filtersKey = searchParams.toString();
  const [previousFiltersKey, setPreviousFiltersKey] = useState(filtersKey);

  if (filtersKey !== previousFiltersKey) {
    setPreviousFiltersKey(filtersKey);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    if (!selectAllRef.current) return;
    const visibleSelectedCount = transactions.filter((t) => selectedIds.has(t.id)).length;
    selectAllRef.current.indeterminate = visibleSelectedCount > 0 && visibleSelectedCount < transactions.length;
  }, [selectedIds, transactions]);

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
      const allVisibleSelected = transactions.every((t) => prev.has(t.id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        transactions.forEach((t) => next.delete(t.id));
        return next;
      }
      const next = new Set(prev);
      transactions.forEach((t) => next.add(t.id));
      return next;
    });
  }

  function closeBulkEdit() {
    setBulkEditOpen(false);
    setSelectedIds(new Set());
  }

  function goToPage(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(nextPage));
    }
    router.push(params.size > 0 ? `/lancamentos?${params.toString()}` : "/lancamentos", { scroll: false });
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-text)">Lançamentos</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">Registre e acompanhe suas entradas e despesas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo lançamento
        </Button>
      </div>

      <TransactionFiltersBar categories={categories} />

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

      {transactions.length === 0 ? (
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
                checked={transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id))}
                onChange={toggleSelectAllVisible}
                aria-label="Selecionar todos os lançamentos exibidos nesta página"
                className="h-4 w-4 shrink-0 rounded border-(--color-border) accent-(--color-primary)"
              />
              <span className="text-xs text-(--color-text-muted)">Selecionar todos os exibidos</span>
            </div>
            {transactions.map((transaction) => (
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-(--color-text-muted)">
              Página {page} de {totalPages} · {totalCount} lançamento(s)
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Anterior
              </Button>
              <Button type="button" variant="secondary" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                Próxima
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
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
