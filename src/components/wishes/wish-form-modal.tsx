"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWishAction } from "@/app/(app)/desejos/actions";
import { WishStrategyStep, type AvailableGoal } from "@/components/wishes/wish-strategy-step";

export type WishFormCategory = { id: string; name: string; children: { id: string; name: string }[] };

type Step = "details" | "strategy";

type WishFormModalProps = {
  open: boolean;
  categories: WishFormCategory[];
  availableGoals: AvailableGoal[];
  onClose: () => void;
};

const initialFieldErrors: Record<string, string> = {};

export function WishFormModal({ open, categories, availableGoals, onClose }: WishFormModalProps) {
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [estimatedAmount, setEstimatedAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState(initialFieldErrors);
  const [createdWishId, setCreatedWishId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const subcategoryOptions = selectedCategory?.children ?? [];

  function resetAndClose() {
    setStep("details");
    setName("");
    setEstimatedAmount("");
    setCategoryId("");
    setSubcategoryId("");
    setNotes("");
    setFieldErrors({});
    setCreatedWishId(null);
    onClose();
  }

  function handleSubmitDetails(event: React.FormEvent) {
    event.preventDefault();

    startTransition(async () => {
      const result = await createWishAction({
        name,
        estimatedAmount: Number(estimatedAmount.replace(",", ".")) || 0,
        categoryId,
        subcategoryId,
        notes: notes || undefined,
      });

      if (!result.success || !result.wishId) {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message ?? "Não foi possível cadastrar o desejo");
        return;
      }

      toast.success(result.message ?? "Desejo cadastrado");
      setFieldErrors({});
      setCreatedWishId(result.wishId);
      setStep("strategy");
    });
  }

  return (
    <Modal open={open} title={step === "details" ? "Novo desejo" : "Plano de economia"} onClose={resetAndClose}>
      {step === "details" ? (
        <form onSubmit={handleSubmitDetails} className="flex flex-col gap-4">
          <Input
            label="Nome do desejo"
            name="name"
            placeholder="Ex.: Geladeira nova"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
            required
          />

          <Input
            label="Valor estimado (R$)"
            name="estimatedAmount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            value={estimatedAmount}
            onChange={(event) => setEstimatedAmount(event.target.value)}
            error={fieldErrors.estimatedAmount}
            className="font-numeric"
            required
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="categoryId" className="text-sm font-medium text-(--color-text)">
                Grupo
              </label>
              <select
                id="categoryId"
                name="categoryId"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSubcategoryId("");
                }}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
                required
              >
                <option value="">Selecione um grupo</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && <p className="text-xs text-(--color-danger)">{fieldErrors.categoryId}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="subcategoryId" className="text-sm font-medium text-(--color-text)">
                Sub-grupo
              </label>
              <select
                key={categoryId}
                id="subcategoryId"
                name="subcategoryId"
                value={subcategoryId}
                onChange={(event) => setSubcategoryId(event.target.value)}
                disabled={subcategoryOptions.length === 0}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="">Selecione um sub-grupo</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
              {fieldErrors.subcategoryId && <p className="text-xs text-(--color-danger)">{fieldErrors.subcategoryId}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-(--color-text)">
              Observações (opcional)
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ex.: Aquele modelo específico que vi na loja"
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={resetAndClose}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isPending}>
              Cadastrar desejo
            </Button>
          </div>
        </form>
      ) : createdWishId ? (
        <WishStrategyStep
          wishId={createdWishId}
          wishName={name}
          estimatedAmount={Number(estimatedAmount.replace(",", ".")) || 0}
          availableGoals={availableGoals}
          onBack={() => setStep("details")}
          onDone={resetAndClose}
        />
      ) : null}
    </Modal>
  );
}
