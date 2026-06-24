"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PartyPopper } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { markWishPurchasedAction } from "@/app/(app)/desejos/actions";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

type WishPurchaseModalProps = {
  open: boolean;
  wishId: string;
  wishName: string;
  estimatedAmount: number;
  onClose: () => void;
};

export function WishPurchaseModal({ open, wishId, wishName, estimatedAmount, onClose }: WishPurchaseModalProps) {
  const router = useRouter();
  const [createTransaction, setCreateTransaction] = useState(true);
  const [amount, setAmount] = useState(String(estimatedAmount));
  const [date, setDate] = useState(todayISODate());
  const [celebrating, setCelebrating] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetAndClose() {
    setCreateTransaction(true);
    setAmount(String(estimatedAmount));
    setDate(todayISODate());
    setCelebrating(false);
    onClose();
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await markWishPurchasedAction({
        wishId,
        createTransaction,
        amount: createTransaction ? Number(amount.replace(",", ".")) || 0 : undefined,
        date: createTransaction ? date : undefined,
      });

      if (!result.success) {
        toast.error(result.message ?? "Não foi possível concluir o desejo");
        return;
      }

      toast.success(result.message ?? "Desejo concluído");
      setCelebrating(true);
    });
  }

  return (
    <Modal open={open} title={celebrating ? "Desejo realizado!" : "Marcar como comprado"} onClose={resetAndClose}>
      {celebrating ? (
        <Card className="flex flex-col items-center gap-4 border-0 p-0 py-6 text-center shadow-none">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-success)/10 text-(--color-success)">
            <PartyPopper className="h-8 w-8" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold text-(--color-text)">Parabéns, você conquistou {wishName}!</h2>
            <p className="mt-2 max-w-sm text-sm text-(--color-text-muted)">
              Foi um caminho até aqui — e você concluiu. Já pode pensar no próximo desejo quando quiser.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              resetAndClose();
              router.push("/desejos");
              router.refresh();
            }}
          >
            Ver minha lista de desejos
          </Button>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-(--color-text-muted)">
            Quer registrar essa compra como um lançamento real, ou só marcar este desejo como concluído (por
            exemplo, se você já vinha pagando via parcelamento e isso é só o reconhecimento da meta atingida)?
          </p>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1">
            <button
              type="button"
              onClick={() => setCreateTransaction(true)}
              aria-pressed={createTransaction}
              className={`rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                createTransaction ? "bg-(--color-primary) text-white shadow-sm" : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              Lançar a compra
            </button>
            <button
              type="button"
              onClick={() => setCreateTransaction(false)}
              aria-pressed={!createTransaction}
              className={`rounded-lg py-2 text-sm font-medium transition-all duration-200 ${
                !createTransaction ? "bg-(--color-primary) text-white shadow-sm" : "text-(--color-text-muted) hover:text-(--color-text)"
              }`}
            >
              Só marcar concluído
            </button>
          </div>

          {createTransaction && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Valor pago (R$)"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="font-numeric"
                required
              />
              <Input
                label="Data da compra"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Concluir desejo
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
