"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { clsx } from "clsx";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { TagInput } from "@/components/transactions/tag-input";
import { CategoryForm } from "@/components/groups/category-form";
import {
  createTransactionAction,
  updateTransactionAction,
  type ActionResult,
} from "@/app/(app)/lancamentos/actions";

const initialState: ActionResult = { success: false };

export type TransactionFormCategory = { id: string; name: string; children: { id: string; name: string }[] };

export type TransactionFormValues = {
  id: string;
  type: "EXPENSE" | "INCOME";
  date: string;
  description: string;
  amount: string;
  categoryId: string;
  subcategoryId: string;
  isFixed: boolean;
  recurrence: "NONE" | "WEEKLY" | "MONTHLY";
  tags: string[];
};

type TransactionFormProps = {
  categories: TransactionFormCategory[];
  tagSuggestions: string[];
  transaction?: TransactionFormValues;
  onDone: () => void;
};

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

export function TransactionForm({ categories, tagSuggestions, transaction, onDone }: TransactionFormProps) {
  const router = useRouter();
  const action = transaction ? updateTransactionAction : createTransactionAction;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [type, setType] = useState<"EXPENSE" | "INCOME">(transaction?.type ?? "EXPENSE");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [isInstallment, setIsInstallment] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const subcategoryOptions = selectedCategory?.children ?? [];

  useEffect(() => {
    if (state.success) {
      toast.success(state.message ?? "Feito!");
      onDone();
    } else if (state.message) {
      toast.error(state.message);
    }
  }, [state, onDone]);

  function handleCategoryCreated() {
    setCategoryModalOpen(false);
    router.refresh();
    toast("Selecione o novo grupo na lista após a atualização", { icon: "💡" });
  }

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        {transaction && <input type="hidden" name="id" value={transaction.id} />}
        <input type="hidden" name="type" value={type} />

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-(--color-text)">Tipo</legend>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) p-1">
            {(
              [
                { value: "EXPENSE", label: "Despesa" },
                { value: "INCOME", label: "Entrada" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                aria-pressed={type === option.value}
                className={clsx(
                  "rounded-lg py-2 text-sm font-medium transition-all duration-200",
                  type === option.value
                    ? option.value === "EXPENSE"
                      ? "bg-(--color-danger) text-white shadow-sm"
                      : "bg-(--color-success) text-white shadow-sm"
                    : "text-(--color-text-muted) hover:text-(--color-text)"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Data"
            name="date"
            type="date"
            defaultValue={transaction?.date ?? todayISODate()}
            error={state.fieldErrors?.date}
            required
          />
          <Input
            label="Valor (R$)"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            defaultValue={transaction?.amount}
            error={state.fieldErrors?.amount}
            className="font-numeric"
            required
          />
        </div>

        <Input
          label="Descrição"
          name="description"
          type="text"
          placeholder="Ex.: Almoço no shopping"
          defaultValue={transaction?.description}
          error={state.fieldErrors?.description}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="categoryId" className="text-sm font-medium text-(--color-text)">
                Grupo
              </label>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-(--color-primary) hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Novo grupo
              </button>
            </div>
            <select
              id="categoryId"
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            >
              <option value="">Sem grupo</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="subcategoryId" className="text-sm font-medium text-(--color-text)">
              Sub-grupo
            </label>
            <select
              key={categoryId}
              id="subcategoryId"
              name="subcategoryId"
              defaultValue={categoryId === transaction?.categoryId ? transaction?.subcategoryId ?? "" : ""}
              disabled={subcategoryOptions.length === 0}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Sem sub-grupo</option>
              {subcategoryOptions.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="recurrence" className="text-sm font-medium text-(--color-text)">
              Repetição
            </label>
            <select
              id="recurrence"
              name="recurrence"
              defaultValue={transaction?.recurrence ?? "NONE"}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            >
              <option value="NONE">Único</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-1.5 pb-1">
            <label className="flex items-center gap-2.5 text-sm font-medium text-(--color-text)">
              <input
                type="checkbox"
                name="isFixed"
                defaultChecked={transaction?.isFixed}
                className="h-4 w-4 rounded border-(--color-border) accent-(--color-primary)"
              />
              Despesa fixa
            </label>
            <p className="text-xs text-(--color-text-muted)">Marque para gastos recorrentes como aluguel ou assinaturas</p>
          </div>
        </div>

        {!transaction && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-(--color-border) bg-(--color-bg) p-3.5">
            <label className="flex items-center gap-2.5 text-sm font-medium text-(--color-text)">
              <input
                type="checkbox"
                name="isInstallment"
                checked={isInstallment}
                onChange={(event) => setIsInstallment(event.target.checked)}
                className="h-4 w-4 rounded border-(--color-border) accent-(--color-primary)"
              />
              Esta despesa é parcelada?
            </label>
            {isInstallment ? (
              <>
                <Input
                  label="Quantidade de parcelas"
                  name="totalInstallments"
                  type="number"
                  min="2"
                  max="360"
                  step="1"
                  placeholder="Ex.: 4"
                  error={state.fieldErrors?.totalInstallments}
                  required
                />
                <p className="text-xs text-(--color-text-muted)">
                  A numeração da parcela será adicionada automaticamente à descrição. As demais parcelas serão
                  lançadas automaticamente nos meses seguintes, com a mesma categoria, sub-grupo e hashtags.
                </p>
              </>
            ) : (
              <p className="text-xs text-(--color-text-muted)">Marque se esta despesa será paga em mais de uma parcela</p>
            )}
          </div>
        )}

        <TagInput
          name="tags"
          defaultTags={transaction?.tags ?? []}
          suggestions={tagSuggestions}
          error={state.fieldErrors?.tags}
        />

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            {transaction ? "Salvar alterações" : "Adicionar lançamento"}
          </Button>
        </div>
      </form>

      <Modal open={categoryModalOpen} title="Novo grupo" onClose={() => setCategoryModalOpen(false)}>
        <CategoryForm onDone={handleCategoryCreated} />
      </Modal>
    </>
  );
}
