"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form";
import { bulkUpdateTransactionsAction } from "@/app/(app)/lancamentos/actions";

type BulkEditFormProps = {
  ids: string[];
  categories: TransactionFormCategory[];
  onDone: () => void;
};

function FieldToggle({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-2 text-sm font-medium text-(--color-text)">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="h-4 w-4 rounded border-(--color-border) accent-(--color-primary)"
        />
        {label}
      </label>
      {children}
    </div>
  );
}

const selectClassName =
  "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50";

const inputClassName =
  "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50";

export function BulkEditForm({ ids, categories, onDone }: BulkEditFormProps) {
  const [isPending, startTransition] = useTransition();

  const [applyCategory, setApplyCategory] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [applySubcategory, setApplySubcategory] = useState(false);
  const [subcategoryId, setSubcategoryId] = useState("");
  const [applyAmount, setApplyAmount] = useState(false);
  const [amount, setAmount] = useState("");
  const [applyDescription, setApplyDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [applyDate, setApplyDate] = useState(false);
  const [date, setDate] = useState("");

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const subcategoryOptions = selectedCategory?.children ?? [];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!applyCategory && !applySubcategory && !applyAmount && !applyDescription && !applyDate) {
      toast.error("Marque ao menos um campo para alterar");
      return;
    }

    const input: Record<string, unknown> = { ids };

    if (applyCategory) input.categoryId = categoryId || null;
    if (applySubcategory) input.subcategoryId = subcategoryId || null;

    if (applyAmount) {
      const numeric = Number(amount);
      if (Number.isNaN(numeric) || numeric <= 0) {
        toast.error("Informe um valor maior que zero");
        return;
      }
      input.amount = numeric;
    }

    if (applyDescription) {
      if (!description.trim()) {
        toast.error("Informe uma descrição");
        return;
      }
      input.description = description.trim();
    }

    if (applyDate) {
      if (!date) {
        toast.error("Informe a data");
        return;
      }
      input.date = date;
    }

    startTransition(async () => {
      const result = await bulkUpdateTransactionsAction(input);
      if (result.success) {
        toast.success(result.message ?? "Lançamentos atualizados");
        onDone();
      } else {
        const firstFieldError = result.fieldErrors ? Object.values(result.fieldErrors)[0] : undefined;
        toast.error(result.message ?? firstFieldError ?? "Não foi possível atualizar os lançamentos");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-(--color-text-muted)">
        Marque apenas os campos que deseja alterar. Os demais lançamentos manterão seus valores atuais.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldToggle label="Grupo" checked={applyCategory} onChange={setApplyCategory}>
          <select
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setSubcategoryId("");
            }}
            disabled={!applyCategory}
            className={selectClassName}
          >
            <option value="">Sem grupo</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FieldToggle>

        <FieldToggle label="Sub-grupo" checked={applySubcategory} onChange={setApplySubcategory}>
          <select
            value={subcategoryId}
            onChange={(event) => setSubcategoryId(event.target.value)}
            disabled={!applySubcategory || subcategoryOptions.length === 0}
            className={selectClassName}
          >
            <option value="">Sem sub-grupo</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        </FieldToggle>
      </div>

      {applySubcategory && !applyCategory && (
        <p className="-mt-2 text-xs text-(--color-text-muted)">
          Para alterar o sub-grupo sem alterar o grupo, todos os lançamentos selecionados precisam ter o mesmo grupo atual.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldToggle label="Valor (R$)" checked={applyAmount} onChange={setApplyAmount}>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={!applyAmount}
            className={`${inputClassName} font-numeric`}
          />
        </FieldToggle>

        <FieldToggle label="Data" checked={applyDate} onChange={setApplyDate}>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            disabled={!applyDate}
            className={inputClassName}
          />
        </FieldToggle>
      </div>

      <FieldToggle label="Descrição" checked={applyDescription} onChange={setApplyDescription}>
        <input
          type="text"
          placeholder="Ex.: Almoço no shopping"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={!applyDescription}
          className={inputClassName}
        />
      </FieldToggle>

      <div className="mt-1 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isPending}>
          Aplicar a {ids.length} lançamento{ids.length === 1 ? "" : "s"}
        </Button>
      </div>
    </form>
  );
}
