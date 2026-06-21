"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
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
import { toInputDate } from "@/lib/format";
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
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
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
