"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreditCardList } from "@/components/credit-cards/credit-card-list";
import { CreditCardForm } from "@/components/credit-cards/credit-card-form";
import { deleteCreditCardAction } from "@/app/(app)/lancamentos/cartoes/actions";

// CreditCard (lucide) é o ícone; o tipo de dado usa um nome diferente para evitar conflito
type CreditCardData = {
  id: string;
  bankCode: string;
  nickname: string | null;
  limit: number;
  dueDay: number;
  createdAt: Date;
  updatedAt: Date;
};

type CreditCardsManagerProps = {
  cards: CreditCardData[];
};

export function CreditCardsManager({ cards }: CreditCardsManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  function openCreate() {
    setEditingCard(null);
    setModalOpen(true);
  }

  function openEdit(card: CreditCardData) {
    setEditingCard(card);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCard(null);
  }

  function handleFormSuccess() {
    toast.success(editingCard ? "Cartão atualizado" : "Cartão cadastrado");
    closeModal();
  }

  function confirmDelete() {
    if (!deletingId) return;
    startDeleteTransition(async () => {
      const result = await deleteCreditCardAction(deletingId);
      if (result.success) {
        toast.success(result.message ?? "Cartão excluído");
      } else {
        toast.error(result.message ?? "Não foi possível excluir o cartão");
      }
      setDeletingId(null);
    });
  }

  const modalTitle = editingCard ? "Editar cartão" : "Novo cartão";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/lancamentos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-primary) hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para lançamentos
      </Link>

      <PageHeader
        title="Cartões de crédito"
        description="Gerencie seus cartões para acompanhar limites e datas de vencimento"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo cartão
          </Button>
        }
      />

      <CreditCardList
        cards={cards}
        onEdit={openEdit}
        onDelete={(id) => setDeletingId(id)}
      />

      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        <CreditCardForm
          initialData={editingCard ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={closeModal}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingId)}
        title="Excluir cartão"
        description="Tem certeza que deseja excluir este cartão? Essa ação não pode ser desfeita."
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
