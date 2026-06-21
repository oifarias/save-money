"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, FileSpreadsheet, UserRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { TransactionForm, type TransactionFormCategory } from "@/components/transactions/transaction-form";

type TransactionIntakeProps = {
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
};

export function TransactionIntake({ categories, tagSuggestions }: TransactionIntakeProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function closeForm() {
    setFormOpen(false);
    setFormKey((current) => current + 1);
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-(--color-text)">Novo lançamento</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Registre um lançamento individual ou importe várias linhas de uma planilha
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 cursor-pointer hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-primary)/10 text-(--color-primary)">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-sm font-semibold text-(--color-text)">Individual</span>
            <span className="mt-0.5 block text-xs text-(--color-text-muted)">
              Um lançamento por vez, com categoria e tags
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </button>

        <Link
          href="/lancamentos/importar"
          className="group flex items-start gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) px-4 py-3.5 text-left transition-colors duration-200 hover:border-(--color-primary)/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
            <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex-1">
            <span className="block font-display text-sm font-semibold text-(--color-text)">Importar planilha</span>
            <span className="mt-0.5 block text-xs text-(--color-text-muted)">
              Várias linhas de uma vez, a partir de um .xlsx ou .xls
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      <Modal open={formOpen} title="Novo lançamento" onClose={closeForm}>
        <TransactionForm key={formKey} categories={categories} tagSuggestions={tagSuggestions} onDone={closeForm} />
      </Modal>
    </section>
  );
}
