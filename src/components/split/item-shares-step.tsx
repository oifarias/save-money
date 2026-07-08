"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { formatCurrency, formatDate } from "@/lib/format";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import type { SplitItemDraft, SplitParticipant } from "@/components/split/split-wizard";

type ItemSharesStepProps = {
  eligible: TransactionListItem[];
  participants: SplitParticipant[];
  itemDrafts: SplitItemDraft[];
  onUpdateItem: (transactionId: string, patch: Partial<SplitItemDraft>) => void;
  onNext: () => void;
  onBack: () => void;
};

function isItemValid(draft: SplitItemDraft | undefined) {
  if (!draft) return false;
  return draft.shares.length > 0 && draft.shares.every((s) => s.amount > 0);
}

/** Divide `totalCents` em `count` partes o mais iguais possível, sem perder centavo por arredondamento. */
function splitCentsEvenly(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count);
  const extra = totalCents - base * count;
  return Array.from({ length: count }, (_, position) => base + (position < extra ? 1 : 0));
}

function ItemCard({
  tx,
  draft,
  participants,
  onUpdateItem,
}: {
  tx: TransactionListItem;
  draft: SplitItemDraft;
  participants: SplitParticipant[];
  onUpdateItem: (transactionId: string, patch: Partial<SplitItemDraft>) => void;
}) {
  const sharesTotal = draft.shares.reduce((sum, s) => sum + s.amount, 0);
  const diff = Math.round((tx.amount - sharesTotal) * 100) / 100;

  function toggleParticipant(index: number) {
    const checkedIndices = draft.shares.map((s) => s.participantIndex);
    const nextIndices = checkedIndices.includes(index)
      ? checkedIndices.filter((i) => i !== index)
      : [...checkedIndices, index];

    if (nextIndices.length === 0) {
      onUpdateItem(tx.id, { shares: [] });
      return;
    }

    // Divide o total igualmente entre quem ficou marcado — reflete a intuição comum de que
    // remover/adicionar uma pessoa deveria redistribuir o valor, não deixar sobra parada.
    const sorted = nextIndices.slice().sort((a, b) => a - b);
    const cents = splitCentsEvenly(Math.round(tx.amount * 100), sorted.length);
    onUpdateItem(tx.id, {
      shares: sorted.map((participantIndex, position) => ({
        participantIndex,
        amount: cents[position] / 100,
      })),
    });
  }

  function updateShareAmount(index: number, value: string) {
    const amount = Math.max(0, Number(value.replace(",", ".")) || 0);
    const otherIndices = draft.shares.map((s) => s.participantIndex).filter((i) => i !== index);

    if (otherIndices.length === 0) {
      onUpdateItem(tx.id, {
        shares: draft.shares.map((s) => (s.participantIndex === index ? { ...s, amount } : s)),
      });
      return;
    }

    // O valor digitado fica fixo; o restante do total é redistribuído igualmente entre as
    // demais pessoas marcadas nesse lançamento — ex.: R$200 para 2 pessoas, uma paga R$130,
    // a outra assume automaticamente os R$70 restantes.
    const remainderCents = Math.round((tx.amount - amount) * 100);
    const cents = splitCentsEvenly(remainderCents, otherIndices.length);
    onUpdateItem(tx.id, {
      shares: draft.shares.map((s) => {
        if (s.participantIndex === index) return { ...s, amount };
        const position = otherIndices.indexOf(s.participantIndex);
        return { ...s, amount: cents[position] / 100 };
      }),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-(--color-text)">{tx.description}</p>
          <p className="text-xs text-(--color-text-muted)">{formatDate(tx.date)}</p>
        </div>
        <span className="shrink-0 font-numeric text-sm font-semibold text-(--color-text)">
          {formatCurrency(tx.amount)}
        </span>
      </div>

      <Input
        placeholder="Observação (opcional) — ex.: rodízio de sexta"
        value={draft.note}
        maxLength={200}
        onChange={(event) => onUpdateItem(tx.id, { note: event.target.value })}
      />

      <div className="flex flex-col gap-2">
        {participants.map((participant, index) => {
          const share = draft.shares.find((s) => s.participantIndex === index);
          const checked = Boolean(share);
          return (
            <label
              key={index}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-(--color-border) bg-(--color-bg) p-2.5 transition-colors has-[:checked]:border-(--color-primary)"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleParticipant(index)}
                className="h-4 w-4 shrink-0 accent-(--color-primary)"
              />
              <span className="min-w-0 flex-1 truncate text-sm text-(--color-text)">
                {participant.name || `Pessoa ${index + 1}`}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="0,00"
                disabled={!checked}
                value={share ? (share.amount === 0 ? "" : share.amount) : ""}
                onChange={(event) => updateShareAmount(index, event.target.value)}
                className="w-24 shrink-0 rounded-lg border border-(--color-border) bg-(--color-surface) px-2.5 py-1.5 text-right font-numeric text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-40"
              />
            </label>
          );
        })}
      </div>

      {diff !== 0 && (
        <p className="text-xs font-medium text-(--color-danger)">
          {formatCurrency(sharesTotal)} de {formatCurrency(tx.amount)} — a soma não bate com o valor do lançamento
        </p>
      )}
    </div>
  );
}

export function ItemSharesStep({ eligible, participants, itemDrafts, onUpdateItem, onNext, onBack }: ItemSharesStepProps) {
  const useCollapsible = eligible.length > 3;
  const invalidCount = eligible.filter((tx) => !isItemValid(itemDrafts.find((d) => d.transactionId === tx.id))).length;
  const canProceed = invalidCount === 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Quem paga o quê em cada lançamento?</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Marque quem participa de cada lançamento e o valor que cada um paga.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {eligible.map((tx) => {
          const draft = itemDrafts.find((d) => d.transactionId === tx.id);
          if (!draft) return null;

          if (!useCollapsible) {
            return (
              <div key={tx.id} className="rounded-xl border border-(--color-border) p-3.5">
                <ItemCard tx={tx} draft={draft} participants={participants} onUpdateItem={onUpdateItem} />
              </div>
            );
          }

          return (
            <div key={tx.id} className="rounded-xl border border-(--color-border) p-3.5">
              <CollapsibleSection
                title={tx.description}
                description={`${formatDate(tx.date)} · ${formatCurrency(tx.amount)}`}
                level="h3"
                defaultOpen={false}
              >
                <ItemCard tx={tx} draft={draft} participants={participants} onUpdateItem={onUpdateItem} />
              </CollapsibleSection>
            </div>
          );
        })}
      </div>

      {!canProceed && (
        <p className="text-xs font-medium text-(--color-danger)">
          {invalidCount} lançamento{invalidCount === 1 ? "" : "s"} sem participante ou com valor inválido.
        </p>
      )}

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="button" onClick={onNext} disabled={!canProceed}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
