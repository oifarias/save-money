"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Plus, SlidersHorizontal, Trash2, Users } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { SplitMode, SplitParticipant } from "@/components/split/split-wizard";

type Row = { name: string; amount: string };

type DivideStepProps = {
  total: number;
  initialMode: SplitMode | null;
  initialParticipants: SplitParticipant[];
  onConfirmed: (mode: SplitMode, participants: SplitParticipant[]) => void;
  onBack: () => void;
};

const MODE_OPTIONS = [
  {
    value: "equal" as const,
    label: "Igualmente entre todos",
    description: "O valor total é dividido em partes iguais",
    icon: Users,
  },
  {
    value: "custom" as const,
    label: "Valores personalizados",
    description: "Você define quanto cada pessoa paga",
    icon: SlidersHorizontal,
  },
];

function buildInitialRows(participants: SplitParticipant[]): Row[] {
  if (participants.length > 0) {
    return participants.map((p) => ({ name: p.name, amount: p.amount ? String(p.amount) : "" }));
  }
  return [{ name: "Você", amount: "" }, { name: "", amount: "" }];
}

export function DivideStep({ total, initialMode, initialParticipants, onConfirmed, onBack }: DivideStepProps) {
  const [mode, setMode] = useState<SplitMode | null>(initialMode);
  const [rows, setRows] = useState<Row[]>(() => buildInitialRows(initialParticipants));

  const equalShare = rows.length > 0 ? total / rows.length : 0;
  const customTotal = rows.reduce((sum, row) => sum + (Number(row.amount.replace(",", ".")) || 0), 0);
  const customDiff = Math.round((total - customTotal) * 100) / 100;

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { name: "", amount: "" }]);
  }

  function removeRow(index: number) {
    setRows((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));
  }

  function handleNext() {
    if (!mode) return;
    const participants: SplitParticipant[] = rows
      .filter((row) => row.name.trim().length > 0)
      .map((row) => ({
        name: row.name.trim(),
        amount: mode === "equal" ? equalShare : Number(row.amount.replace(",", ".")) || 0,
      }));
    if (participants.length === 0) return;
    onConfirmed(mode, participants);
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Como vamos dividir?</h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = mode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={isActive}
              className={clsx(
                "flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors duration-200",
                isActive
                  ? "border-(--color-primary) bg-(--color-primary)/10"
                  : "border-(--color-border) bg-(--color-surface) hover:border-(--color-primary)/40"
              )}
            >
              <span
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  isActive ? "bg-(--color-primary) text-white" : "bg-(--color-bg) text-(--color-text-muted)"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span
                  className={clsx(
                    "block font-display text-sm font-semibold",
                    isActive ? "text-(--color-primary)" : "text-(--color-text)"
                  )}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-(--color-text-muted)">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      {mode && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-(--color-text)">Quem participa?</p>
            {mode === "custom" && (
              <p
                className={
                  customDiff !== 0 ? "text-xs font-medium text-(--color-danger)" : "text-xs text-(--color-text-muted)"
                }
              >
                {formatCurrency(customTotal)} de {formatCurrency(total)}
              </p>
            )}
          </div>

          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                placeholder={index === 0 ? "Você" : "Nome"}
                value={row.name}
                onChange={(event) => updateRow(index, { name: event.target.value })}
                className="flex-1 rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
              />
              {mode === "equal" ? (
                <span className="w-28 shrink-0 text-right font-numeric text-sm text-(--color-text-muted)">
                  {formatCurrency(equalShare)}
                </span>
              ) : (
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={row.amount}
                  onChange={(event) => updateRow(index, { amount: event.target.value })}
                  className="w-28 shrink-0 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-right font-numeric text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                />
              )}
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={rows.length <= 1}
                aria-label="Remover pessoa"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger) disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          <Button type="button" variant="ghost" onClick={addRow} className="self-start">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Adicionar pessoa
          </Button>
        </div>
      )}

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <Button type="button" onClick={handleNext} disabled={!mode}>
          Continuar
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
