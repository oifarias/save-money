"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";

type TitleStepProps = {
  title: string;
  onTitleChange: (value: string) => void;
  transactionsCount: number;
  total: number;
  ignoredCount: number;
  onNext: () => void;
};

export function TitleStep({ title, onTitleChange, transactionsCount, total, ignoredCount, onNext }: TitleStepProps) {
  const [error, setError] = useState<string>();

  function handleNext() {
    if (!title.trim()) {
      setError("Informe um título");
      return;
    }
    setError(undefined);
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Como você quer chamar essa conta?</h2>
      </div>

      <Input
        label="Título"
        placeholder="Ex.: Jantar de sexta, Viagem à praia..."
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        error={error}
        autoFocus
      />

      <p className="text-sm text-(--color-text-muted)">
        {transactionsCount} lançamento{transactionsCount === 1 ? "" : "s"} selecionado{transactionsCount === 1 ? "" : "s"} ·{" "}
        <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(total)}</span>
      </p>

      {ignoredCount > 0 && (
        <p className="text-xs text-(--color-text-muted)">
          {ignoredCount} lançamento{ignoredCount === 1 ? "" : "s"} de entrada {ignoredCount === 1 ? "foi" : "foram"}{" "}
          ignorado{ignoredCount === 1 ? "" : "s"}, já que dividir conta é só pra despesas.
        </p>
      )}

      <div className="mt-1 flex justify-end">
        <Button type="button" onClick={handleNext} disabled={transactionsCount === 0}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
