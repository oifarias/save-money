"use client";

import { FileSpreadsheet, UserRound } from "lucide-react";
import { IntakeOption } from "@/components/ui/intake-option";

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
        <IntakeOption
          onClick={onIndividual}
          icon={UserRound}
          title="Individual"
          description="Um ou mais itens do mesmo grupo, com plano de compra"
        />
        <IntakeOption
          onClick={onBulk}
          icon={FileSpreadsheet}
          title="Em lote"
          description="Várias linhas de uma vez, a partir de um arquivo .csv ou .txt"
          colorToken="--color-accent"
        />
      </div>
    </section>
  );
}
