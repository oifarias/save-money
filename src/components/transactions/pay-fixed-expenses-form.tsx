"use client";

import { useState, useTransition, type FormEvent } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { toInputDate } from "@/lib/format";
import { payFixedExpensesAction } from "@/app/(app)/lancamentos/actions";
import type { FixedExpenseChecklistItem } from "@/lib/fixed-expenses-data";

type PayFixedExpensesFormProps = {
  items: FixedExpenseChecklistItem[];
  onDone: () => void;
};

type DraftItem = {
  templateId: string;
  description: string;
  paidAmount: string;
  paidDate: string;
};

const inputClassName =
  "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50";

export function PayFixedExpensesForm({ items, onDone }: PayFixedExpensesFormProps) {
  const [isPending, startTransition] = useTransition();
  const today = toInputDate(new Date());

  const [drafts, setDrafts] = useState<DraftItem[]>(() =>
    items.map((item) => ({
      templateId: item.templateId,
      description: item.description,
      paidAmount: String(item.expectedAmount),
      paidDate: today,
    }))
  );

  function updateDraft(templateId: string, patch: Partial<DraftItem>) {
    setDrafts((prev) => prev.map((draft) => (draft.templateId === templateId ? { ...draft, ...patch } : draft)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload: { templateId: string; paidAmount: number; paidDate: string }[] = [];
    for (const draft of drafts) {
      const numeric = Number(draft.paidAmount);
      if (Number.isNaN(numeric) || numeric <= 0) {
        toast.error(`Informe um valor maior que zero para "${draft.description}"`);
        return;
      }
      if (!draft.paidDate) {
        toast.error(`Informe a data de pagamento para "${draft.description}"`);
        return;
      }
      payload.push({ templateId: draft.templateId, paidAmount: numeric, paidDate: draft.paidDate });
    }

    startTransition(async () => {
      const result = await payFixedExpensesAction(payload);
      if (result.success) {
        toast.success(result.message ?? "Despesas marcadas como pagas");
        onDone();
      } else {
        const firstFieldError = result.fieldErrors ? Object.values(result.fieldErrors)[0] : undefined;
        toast.error(result.message ?? firstFieldError ?? "Não foi possível marcar as despesas como pagas");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Confira o valor e a data de pagamento de cada despesa antes de confirmar.
      </p>

      <div className="flex flex-col gap-3">
        {drafts.map((draft) => (
          <div key={draft.templateId} className="rounded-xl border border-(--color-border) p-3.5">
            <p className="mb-3 text-sm font-medium text-(--color-text)">{draft.description}</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-(--color-text-muted)">Valor pago (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={draft.paidAmount}
                  onChange={(event) => updateDraft(draft.templateId, { paidAmount: event.target.value })}
                  disabled={isPending}
                  className={`${inputClassName} font-numeric`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-(--color-text-muted)">Data do pagamento</label>
                <input
                  type="date"
                  value={draft.paidDate}
                  onChange={(event) => updateDraft(draft.templateId, { paidDate: event.target.value })}
                  disabled={isPending}
                  className={inputClassName}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={isPending}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending}>
          Marcar {drafts.length} como paga{drafts.length === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  );
}
