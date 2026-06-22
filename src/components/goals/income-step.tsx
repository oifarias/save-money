"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { saveIncomeBaselineAction } from "@/app/(app)/metas/actions";
import type { IncomeBaseline } from "@/lib/budget-data";

type IncomeStepProps = {
  baseline: IncomeBaseline | null;
  onConfirmed: (amount: number) => void;
};

export function IncomeStep({ baseline, onConfirmed }: IncomeStepProps) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState(baseline ? String(baseline.amount.toFixed(2)) : "");
  const [error, setError] = useState<string>();

  const hasAutoBaseline = Boolean(baseline?.monthlyBreakdown);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount.replace(",", "."));

    if (!numericAmount || numericAmount <= 0) {
      setError("Informe um valor maior que zero");
      return;
    }
    setError(undefined);

    const wasEdited = baseline ? Math.abs(numericAmount - baseline.amount) > 0.01 : true;
    const source = hasAutoBaseline && !wasEdited ? "average_3_months" : "manual";

    startTransition(async () => {
      const result = await saveIncomeBaselineAction({ amount: numericAmount, source });
      if (result.success) {
        onConfirmed(numericAmount);
      } else {
        toast.error(result.message ?? "Não foi possível salvar a renda");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Qual sua renda mensal?</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Vamos usar esse valor pra sugerir como dividir seus gastos por grupo.
        </p>
      </div>

      {hasAutoBaseline && baseline?.monthlyBreakdown ? (
        <div className="rounded-xl border border-(--color-primary)/30 bg-(--color-primary)/5 p-4">
          <p className="text-sm text-(--color-text)">
            Calculamos isso com a média das suas entradas dos últimos 3 meses:
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-xs text-(--color-text-muted)">
            {baseline.monthlyBreakdown.map((month) => (
              <li key={month.key} className="flex justify-between">
                <span className="capitalize">{month.label}</span>
                <span className="font-numeric text-(--color-text)">{formatCurrency(month.amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm font-medium text-(--color-text)">
            Média: <span className="font-numeric text-(--color-primary)">{formatCurrency(baseline.amount)}</span>
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-(--color-border) bg-(--color-bg) p-4 text-sm text-(--color-text-muted)">
          Você ainda não tem 3 meses de entradas registradas — informe sua renda mensal aproximada para começar.
        </p>
      )}

      <Input
        label="Renda mensal (R$)"
        name="amount"
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder="0,00"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={error}
        className="font-numeric"
        required
      />

      <div className="mt-1 flex justify-end">
        <Button type="submit" isLoading={isPending}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
