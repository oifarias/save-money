"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, PiggyBank, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkWishGoalAction } from "@/app/(app)/desejos/actions";

export type AvailableGoal = { id: string; name: string; targetAmount: number; currentAmount: number };

type Choice = "existing" | "new" | null;

type WishStrategyStepProps = {
  wishId: string;
  wishName: string;
  estimatedAmount: number;
  availableGoals: AvailableGoal[];
  onBack: () => void;
  onDone: () => void;
};

export function WishStrategyStep({
  wishId,
  wishName,
  estimatedAmount,
  availableGoals,
  onBack,
  onDone,
}: WishStrategyStepProps) {
  const [choice, setChoice] = useState<Choice>(null);
  const [goalId, setGoalId] = useState("");
  const [targetAmount, setTargetAmount] = useState(String(estimatedAmount));
  const [deadline, setDeadline] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSkip() {
    toast("Sem problema — você pode definir uma estratégia quando quiser na página do desejo", { icon: "💡" });
    onDone();
  }

  function handleConfirm() {
    if (choice === "existing" && !goalId) {
      toast.error("Selecione uma meta existente");
      return;
    }
    if (choice === "new" && (!targetAmount || Number(targetAmount) <= 0)) {
      toast.error("Informe um valor para a nova meta");
      return;
    }

    startTransition(async () => {
      const result = await linkWishGoalAction(
        choice === "existing"
          ? { wishId, goalId }
          : {
              wishId,
              name: wishName,
              targetAmount: Number(targetAmount),
              deadline: deadline || undefined,
            }
      );
      if (result.success) {
        toast.success(result.message ?? "Estratégia vinculada");
        onDone();
      } else {
        toast.error(result.message ?? "Não foi possível vincular a estratégia");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold text-(--color-text)">Quer já se comprometer com um plano?</h2>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Quem decide como vai economizar logo no cadastro tende a manter o foco mais fácil até concluir. Mas tudo
          bem decidir isso depois também.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setChoice("existing")}
          disabled={availableGoals.length === 0}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            choice === "existing" ? "border-(--color-primary) bg-(--color-primary)/5" : "border-(--color-border)"
          }`}
        >
          <Target className="h-5 w-5 shrink-0 text-(--color-primary)" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium text-(--color-text)">Vincular uma meta existente</span>
            <span className="block text-xs text-(--color-text-muted)">
              {availableGoals.length === 0 ? "Você ainda não tem metas disponíveis" : "Use o progresso de uma meta que já existe"}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setChoice("new")}
          className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
            choice === "new" ? "border-(--color-primary) bg-(--color-primary)/5" : "border-(--color-border)"
          }`}
        >
          <PiggyBank className="h-5 w-5 shrink-0 text-(--color-primary)" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium text-(--color-text)">Criar uma meta de economia agora</span>
            <span className="block text-xs text-(--color-text-muted)">Comece a acompanhar o progresso desde já</span>
          </span>
        </button>
      </div>

      {choice === "existing" && (
        <div className="flex flex-col gap-1.5 pl-1">
          <label htmlFor="goalId" className="text-sm font-medium text-(--color-text)">
            Meta
          </label>
          <select
            id="goalId"
            value={goalId}
            onChange={(event) => setGoalId(event.target.value)}
            className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
          >
            <option value="">Selecione uma meta</option>
            {availableGoals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {choice === "new" && (
        <div className="grid grid-cols-1 gap-4 pl-1 sm:grid-cols-2">
          <Input
            label="Valor da meta (R$)"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
          />
          <Input
            label="Prazo (opcional)"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </div>
      )}

      <div className="mt-1 flex justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={handleSkip}>
            Decidir depois
          </Button>
          <Button type="button" onClick={handleConfirm} isLoading={isPending} disabled={!choice}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
