"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { createSplitAction } from "@/app/(app)/lancamentos/split-actions";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import type { SplitMode, SplitParticipant } from "@/components/split/split-wizard";

type SummaryStepProps = {
  title: string;
  mode: SplitMode;
  eligible: TransactionListItem[];
  total: number;
  participants: SplitParticipant[];
  transactionIds: string[];
  onBack: () => void;
  onCreated: (token: string) => void;
};

export function SummaryStep({
  title,
  mode,
  eligible,
  total,
  participants,
  transactionIds,
  onBack,
  onCreated,
}: SummaryStepProps) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await createSplitAction({ title, mode, transactionIds, participants });
      if (result.success && result.token) {
        onCreated(result.token);
      } else {
        toast.error(result.message ?? "Não foi possível criar o link");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">{title}</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">Confira tudo antes de gerar o link.</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-(--color-border) p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Lançamentos incluídos</p>
        {eligible.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-(--color-text)">{tx.description}</span>
            <span className="shrink-0 text-xs text-(--color-text-muted)">{formatDate(tx.date)}</span>
            <span className="shrink-0 font-numeric font-medium text-(--color-text)">{formatCurrency(tx.amount)}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-(--color-border) pt-2 text-sm font-semibold text-(--color-text)">
          <span>Total</span>
          <span className="font-numeric">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-(--color-border) p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Divisão</p>
        {participants.map((p) => (
          <div key={p.name} className="flex items-center justify-between text-sm">
            <span className="text-(--color-text)">{p.name}</span>
            <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(p.amount)}</span>
          </div>
        ))}
      </div>

      <p className="text-sm text-(--color-text-muted)">Ao confirmar, vamos gerar um link pra você compartilhar.</p>

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="button" onClick={handleConfirm} isLoading={isPending}>
          <Check className="h-4 w-4" aria-hidden="true" />
          Confirmar e gerar link
        </Button>
      </div>
    </div>
  );
}
