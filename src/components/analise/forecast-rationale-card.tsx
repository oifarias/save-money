"use client";

import { useState } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { ForecastHorizon, ForecastOverrides, ForecastRationale, ForecastRationaleLine } from "@/lib/analise-forecast";

type Props = {
  rationale: ForecastRationale;
  overrides: ForecastOverrides;
  onOverrideChange: (kind: "expense" | "income", key: string, value: number | null) => void;
  warnings: string[];
  monthsAhead: ForecastHorizon;
};

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Exportada (só) para ser testada isoladamente — é o texto que o cliente lê no card de racional.
export function countLabel(line: ForecastRationaleLine): string {
  switch (line.key) {
    case "fixed":
      return pluralize(line.count, "despesa fixa", "despesas fixas");
    case "installments":
      return pluralize(line.count, "parcelamento ativo", "parcelamentos ativos");
    case "variable":
    case "income_avg":
      return pluralize(line.count, "mês considerado", "meses considerados");
    default:
      return pluralize(line.count, "lançamento", "lançamentos");
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function RationaleRow({
  kind,
  line,
  overrides,
  onOverrideChange,
}: {
  kind: "expense" | "income";
  line: ForecastRationaleLine;
  overrides: ForecastOverrides;
  onOverrideChange: Props["onOverrideChange"];
}) {
  const overrideValue = overrides[kind]?.[line.key];
  const hasOverride = overrideValue !== undefined;
  const displayValue = overrideValue ?? line.amount;

  // Edição em rascunho local: só propaga pro pai (e dispara uma nova busca de previsão no
  // servidor) no blur/Enter, não a cada tecla — digitar "1234" não deve gerar 4 requisições.
  // Ressincroniza o rascunho durante o render (comparando com o valor anterior) em vez de usar
  // useEffect: é o padrão do React para "ajustar state quando um valor muda" e evita a violação
  // da regra de lint react-hooks/set-state-in-effect. https://react.dev/learn/you-might-not-need-an-effect
  const [draft, setDraft] = useState(String(round2(displayValue)));
  const [prevDisplayValue, setPrevDisplayValue] = useState(displayValue);
  if (displayValue !== prevDisplayValue) {
    setPrevDisplayValue(displayValue);
    setDraft(String(round2(displayValue)));
  }

  function commitDraft() {
    const parsed = Number(draft);
    if (draft !== "" && !Number.isNaN(parsed) && parsed !== displayValue) {
      onOverrideChange(kind, line.key, parsed);
    } else {
      setDraft(String(round2(displayValue)));
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm text-(--color-text)">{line.label}</p>
          {hasOverride && (
            <span className="rounded-full bg-(--color-primary)/10 px-1.5 py-0.5 text-xs text-(--color-primary)">
              ajustado
            </span>
          )}
        </div>
        <p className="text-xs text-(--color-text-muted)">{countLabel(line)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-28 py-1.5 text-right"
        />
        {hasOverride && (
          <button
            type="button"
            onClick={() => onOverrideChange(kind, line.key, null)}
            title="Restaurar valor calculado automaticamente"
            className="text-(--color-text-muted) hover:text-(--color-primary) transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ForecastRationaleCard({ rationale, overrides, onOverrideChange, warnings, monthsAhead }: Props) {
  const hasAnyOverride =
    Object.keys(overrides.expense ?? {}).length > 0 || Object.keys(overrides.income ?? {}).length > 0;

  function handleResetAll() {
    for (const key of Object.keys(overrides.expense ?? {})) {
      onOverrideChange("expense", key, null);
    }
    for (const key of Object.keys(overrides.income ?? {})) {
      onOverrideChange("income", key, null);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-(--color-text)">
            Como calculamos essa previsão
          </h2>
          <p className="text-xs text-(--color-text-muted)">
            Projeção para os próximos {monthsAhead} {monthsAhead === 1 ? "mês" : "meses"}, com base no seu histórico.
            Ajuste qualquer valor abaixo para simular outros cenários.
          </p>
        </div>

        {warnings.length > 0 && (
          <Alert variant="warning" icon={TriangleAlert}>
            <ul className="flex flex-col gap-0.5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Alert>
        )}

        {rationale.expense.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
              Despesas
            </p>
            <div className="flex flex-col divide-y divide-(--color-border)">
              {rationale.expense.map((line) => (
                <RationaleRow
                  key={line.key}
                  kind="expense"
                  line={line}
                  overrides={overrides}
                  onOverrideChange={onOverrideChange}
                />
              ))}
            </div>
          </div>
        )}

        {rationale.income.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">
              Entradas
            </p>
            <div className="flex flex-col divide-y divide-(--color-border)">
              {rationale.income.map((line) => (
                <RationaleRow
                  key={line.key}
                  kind="income"
                  line={line}
                  overrides={overrides}
                  onOverrideChange={onOverrideChange}
                />
              ))}
            </div>
          </div>
        )}

        {hasAnyOverride && (
          <button
            type="button"
            onClick={handleResetAll}
            className="self-start text-xs font-medium text-(--color-primary) hover:underline"
          >
            Restaurar previsão automática
          </button>
        )}
      </div>
    </Card>
  );
}
