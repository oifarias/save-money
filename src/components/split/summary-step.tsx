"use client";

import { useMemo, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import { createSplitAction } from "@/app/(app)/lancamentos/split-actions";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import type { SplitItemDraft, SplitMode, SplitParticipant } from "@/components/split/split-wizard";

type SummaryStepProps = {
  title: string;
  mode: SplitMode;
  eligible: TransactionListItem[];
  total: number;
  participants: SplitParticipant[];
  itemDrafts: SplitItemDraft[];
  onUpdateItemNote: (transactionId: string, note: string) => void;
  onBack: () => void;
  onCreated: (token: string) => void;
};

export function SummaryStep({
  title,
  mode,
  eligible,
  total,
  participants,
  itemDrafts,
  onUpdateItemNote,
  onBack,
  onCreated,
}: SummaryStepProps) {
  const [isPending, startTransition] = useTransition();

  const participantTotals = useMemo(() => {
    if (mode === "equal") return participants.map((p) => p.amount);
    return participants.map((_, index) =>
      itemDrafts.reduce(
        (sum, draft) => sum + draft.shares.filter((s) => s.participantIndex === index).reduce((a, s) => a + s.amount, 0),
        0
      )
    );
  }, [mode, participants, itemDrafts]);

  function handleConfirm() {
    startTransition(async () => {
      const items = eligible.map((tx) => {
        const draft = itemDrafts.find((d) => d.transactionId === tx.id);
        return {
          transactionId: tx.id,
          note: draft?.note ?? "",
          shares: mode === "custom" ? draft?.shares ?? [] : [],
        };
      });
      const payload = {
        title,
        mode,
        items,
        participants: participants.map((p, index) => ({ name: p.name, amount: participantTotals[index] })),
      };
      const result = await createSplitAction(payload);
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

      <div className="flex flex-col gap-3 rounded-xl border border-(--color-border) p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Lançamentos incluídos</p>
        {eligible.map((tx) => {
          const draft = itemDrafts.find((d) => d.transactionId === tx.id);
          return (
            <div key={tx.id} className="flex flex-col gap-1.5 border-b border-(--color-border) pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-(--color-text)">{tx.description}</span>
                <span className="shrink-0 text-xs text-(--color-text-muted)">{formatDate(tx.date)}</span>
                <span className="shrink-0 font-numeric font-medium text-(--color-text)">{formatCurrency(tx.amount)}</span>
              </div>

              {mode === "equal" ? (
                <Input
                  placeholder="Observação (opcional) — ex.: rodízio de sexta"
                  value={draft?.note ?? ""}
                  maxLength={200}
                  onChange={(event) => onUpdateItemNote(tx.id, event.target.value)}
                  className="text-xs"
                />
              ) : (
                <>
                  {draft?.note && <p className="text-xs text-(--color-text-muted)">{draft.note}</p>}
                  {draft && draft.shares.length > 0 && (
                    <ul className="flex flex-col gap-0.5">
                      {draft.shares
                        .slice()
                        .sort((a, b) => a.participantIndex - b.participantIndex)
                        .map((share) => (
                          <li key={share.participantIndex} className="flex items-center justify-between text-xs">
                            <span className="text-(--color-text-muted)">
                              {participants[share.participantIndex]?.name} paga
                            </span>
                            <span className="font-numeric font-medium text-(--color-text)">
                              {formatCurrency(share.amount)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
        <div className="mt-1 flex items-center justify-between border-t border-(--color-border) pt-2 text-sm font-semibold text-(--color-text)">
          <span>Total</span>
          <span className="font-numeric">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-(--color-border) p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Divisão</p>
        {participants.map((p, index) => (
          <div key={p.name} className="flex items-center justify-between text-sm">
            <span className="text-(--color-text)">{p.name}</span>
            <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(participantTotals[index])}</span>
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
