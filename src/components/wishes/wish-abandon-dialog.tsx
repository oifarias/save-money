"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { abandonWishAction } from "@/app/(app)/desejos/actions";

type WishAbandonDialogProps = {
  open: boolean;
  wishId: string;
  wishName: string;
  onDone: () => void;
  onCancel: () => void;
};

export function WishAbandonDialog({ open, wishId, wishName, onDone, onCancel }: WishAbandonDialogProps) {
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setReason("");
    onCancel();
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await abandonWishAction({ wishId, reason: reason || undefined });
      if (result.success) {
        toast.success(result.message ?? "Desejo movido para o histórico");
        setReason("");
        onDone();
      } else {
        toast.error(result.message ?? "Não foi possível mover o desejo para o histórico");
      }
    });
  }

  return (
    <ConfirmDialog
      open={open}
      title="Mudar de prioridade"
      description={`Tudo bem deixar "${wishName}" de lado. Desistir de um desejo não é um fracasso — é uma decisão financeira como qualquer outra. Se quiser, conte rapidamente o motivo (totalmente opcional).`}
      confirmLabel="Mover para o histórico"
      variant="primary"
      isLoading={isPending}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="abandon-reason" className="text-sm font-medium text-(--color-text)">
          Motivo (opcional)
        </label>
        <textarea
          id="abandon-reason"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ex.: Prioridades mudaram, encontrei outra solução..."
          className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
        />
      </div>
    </ConfirmDialog>
  );
}
