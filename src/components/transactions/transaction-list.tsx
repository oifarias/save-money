"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TransactionForm,
  type TransactionFormCategory,
  type TransactionFormValues,
} from "@/components/transactions/transaction-form";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency, formatDate, toInputDate } from "@/lib/format";
import { deleteTransactionAction } from "@/app/(app)/lancamentos/actions";

export type TransactionListItem = {
  id: string;
  type: "EXPENSE" | "INCOME";
  date: string;
  description: string;
  amount: number;
  isFixed: boolean;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  category: { id: string; name: string; color: string; icon: string } | null;
  subcategory: { id: string; name: string; color: string; icon: string } | null;
  tags: string[];
};

type TransactionListProps = {
  transactions: TransactionListItem[];
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  title?: string;
  description?: string;
  viewAllHref?: string;
  showHeaderAction?: boolean;
};

export function TransactionList({
  transactions,
  categories,
  tagSuggestions,
  title = "Lançamentos",
  description = "Registre e acompanhe suas entradas e despesas",
  viewAllHref,
  showHeaderAction = true,
}: TransactionListProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | null>(null);
  const [deleting, setDeleting] = useState<TransactionListItem | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-(--color-text)">{title}</h1>
          <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {viewAllHref && (
            <Link href={viewAllHref} className="text-sm font-medium text-(--color-primary) hover:underline">
              Ver todos
            </Link>
          )}
          {showHeaderAction && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo lançamento
            </Button>
          )}
        </div>
      </div>

      {transactions.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-display text-lg font-semibold text-(--color-text)">Nenhum lançamento ainda</p>
          <p className="max-w-sm text-sm text-(--color-text-muted)">
            Comece registrando suas despesas e entradas para acompanhar sua evolução financeira.
          </p>
          <Button onClick={openCreate} className="mt-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar primeiro lançamento
          </Button>
        </Card>
      ) : (
        <Card className="divide-y divide-(--color-border) p-0">
          {transactions.map((transaction) => {
            const Icon = transaction.category ? getCategoryIcon(transaction.category.icon) : null;
            const isExpense = transaction.type === "EXPENSE";
            return (
              <div key={transaction.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                    isExpense ? "bg-(--color-danger)/10 text-(--color-danger)" : "bg-(--color-success)/10 text-(--color-success)"
                  )}
                >
                  {isExpense ? (
                    <ArrowUpRight className="h-4.5 w-4.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownLeft className="h-4.5 w-4.5" aria-hidden="true" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-(--color-text)">{transaction.description}</p>
                    {transaction.isFixed && (
                      <span className="shrink-0 rounded-full bg-(--color-accent)/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
                        Fixa
                      </span>
                    )}
                    {transaction.recurrence !== "NONE" && (
                      <Repeat className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" aria-label="Lançamento recorrente" />
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
                    <span>{formatDate(transaction.date)}</span>
                    {transaction.category && (
                      <span className="flex items-center gap-1">
                        {Icon && <Icon className="h-3 w-3" aria-hidden="true" style={{ color: transaction.category.color }} />}
                        {transaction.category.name}
                        {transaction.subcategory && ` › ${transaction.subcategory.name}`}
                      </span>
                    )}
                    {transaction.tags.map((tag) => (
                      <span key={tag} className="text-(--color-primary)">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <p
                  className={clsx(
                    "shrink-0 font-numeric text-sm font-semibold",
                    isExpense ? "text-(--color-danger)" : "text-(--color-success)"
                  )}
                >
                  {isExpense ? "-" : "+"} {formatCurrency(transaction.amount)}
                </p>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(transaction)}
                    aria-label={`Editar lançamento ${transaction.description}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-primary)"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(transaction)}
                    aria-label={`Excluir lançamento ${transaction.description}`}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-danger)"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <Modal open={formOpen} title={editing ? "Editar lançamento" : "Novo lançamento"} onClose={closeForm}>
        <TransactionForm
          categories={categories}
          tagSuggestions={tagSuggestions}
          transaction={editingValues}
          onDone={closeForm}
        />
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
