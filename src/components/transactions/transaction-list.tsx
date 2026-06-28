"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  TransactionForm,
  type TransactionFormCategory,
  type TransactionFormValues,
  type CreditCardOption,
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
  /** Identifica a que parcelamento esta transação pertence, para exibir o badge "Parcela X/N". */
  installment: { number: number; total: number } | null;
  creditCard: { id: string; bankCode: string; nickname: string | null } | null;
};

type TransactionListProps = {
  transactions: TransactionListItem[];
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  title?: string;
  description?: string;
  viewAllHref?: string;
  showHeaderAction?: boolean;
  creditCards?: CreditCardOption[];
};

export function TransactionList({
  transactions,
  categories,
  tagSuggestions,
  title = "Lançamentos",
  description = "Registre e acompanhe suas entradas e despesas",
  viewAllHref,
  showHeaderAction = true,
  creditCards,
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
        installmentNumber: editing.installment?.number,
        installmentTotal: editing.installment?.total,
        creditCardId: editing.creditCard?.id ?? "",
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        action={
          (viewAllHref || showHeaderAction) ? (
            <>
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
            </>
          ) : undefined
        }
      />

      {transactions.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento ainda"
          description="Comece registrando suas despesas e entradas para acompanhar sua evolução financeira."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeiro lançamento
            </Button>
          }
        />
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
          creditCards={creditCards ?? []}
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
