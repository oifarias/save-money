"use client";

import { ChevronRight, FileSpreadsheet, UserRound } from "lucide-react";

type WishIntakeProps = {
  onIndividual: () => void;
  onBulk: () => void;
};

export function WishIntake({ onIndividual, onBulk }: WishIntakeProps) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-(--color-text)">Novo item</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Cadastre um item individual ou importe vários de uma vez a partir de um arquivo
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onIndividual}
          className="group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 cursor-pointer hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-sm font-semibold text-(--color-text)">Individual</span>
            <span className="mt-0.5 block text-xs text-(--color-text-muted)">
              Um ou mais itens do mesmo grupo, com plano de compra
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          onClick={onBulk}
          className="group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 cursor-pointer hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-sm font-semibold text-(--color-text)">Em lote</span>
            <span className="mt-0.5 block text-xs text-(--color-text-muted)">
              Várias linhas de uma vez, a partir de um arquivo .csv ou .txt
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>
      </div>
    </section>
  );
}
