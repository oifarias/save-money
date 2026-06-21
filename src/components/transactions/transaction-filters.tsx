"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form";

type TransactionFiltersProps = {
  categories: TransactionFormCategory[];
};

const AMOUNT_OPERATORS = [
  { value: "eq", label: "Igual a" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
] as const;

export function TransactionFiltersBar({ categories }: TransactionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [categoryId, setCategoryId] = useState(searchParams.get("categoryId") ?? "");
  const [subcategoryId, setSubcategoryId] = useState(searchParams.get("subcategoryId") ?? "");
  const [description, setDescription] = useState(searchParams.get("description") ?? "");
  const [amountOperator, setAmountOperator] = useState(searchParams.get("amountOperator") ?? "");
  const [amountValue, setAmountValue] = useState(searchParams.get("amountValue") ?? "");
  const [month, setMonth] = useState(searchParams.get("month") ?? "");
  const [day, setDay] = useState(searchParams.get("day") ?? "");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const subcategoryOptions = selectedCategory?.children ?? [];

  function applyFilters(next: Record<string, string>) {
    const params = new URLSearchParams();
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.subcategoryId) params.set("subcategoryId", next.subcategoryId);
    if (next.description) params.set("description", next.description);
    if (next.amountOperator && next.amountValue) {
      params.set("amountOperator", next.amountOperator);
      params.set("amountValue", next.amountValue);
    }
    if (next.month) {
      params.set("month", next.month);
      if (next.day) params.set("day", next.day);
    } else {
      const currentPeriod = searchParams.get("period");
      if (currentPeriod) params.set("period", currentPeriod);
    }
    router.replace(params.size > 0 ? `/lancamentos?${params.toString()}` : "/lancamentos", { scroll: false });
  }

  function scheduleApply(next: Record<string, string>) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters(next), 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const currentValues = { categoryId, subcategoryId, description, amountOperator, amountValue, month, day };

  function handleCategoryChange(value: string) {
    setCategoryId(value);
    setSubcategoryId("");
    applyFilters({ ...currentValues, categoryId: value, subcategoryId: "" });
  }

  function handleSubcategoryChange(value: string) {
    setSubcategoryId(value);
    applyFilters({ ...currentValues, subcategoryId: value });
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    scheduleApply({ ...currentValues, description: value });
  }

  function handleAmountOperatorChange(value: string) {
    setAmountOperator(value);
    applyFilters({ ...currentValues, amountOperator: value });
  }

  function handleAmountValueChange(value: string) {
    setAmountValue(value);
    scheduleApply({ ...currentValues, amountValue: value });
  }

  function handleMonthChange(value: string) {
    setMonth(value);
    applyFilters({ ...currentValues, month: value });
  }

  function handleDayChange(value: string) {
    setDay(value);
    applyFilters({ ...currentValues, day: value });
  }

  function clearFilters() {
    setCategoryId("");
    setSubcategoryId("");
    setDescription("");
    setAmountOperator("");
    setAmountValue("");
    setMonth("");
    setDay("");
    router.replace("/lancamentos", { scroll: false });
  }

  const hasActiveFilters = Boolean(categoryId || subcategoryId || description || (amountOperator && amountValue) || month);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-categoryId" className="text-xs font-medium text-(--color-text-muted)">
            Grupo
          </label>
          <select
            id="filter-categoryId"
            value={categoryId}
            onChange={(event) => handleCategoryChange(event.target.value)}
            className="rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
          >
            <option value="">Todos</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="filter-subcategoryId" className="text-xs font-medium text-(--color-text-muted)">
            Sub-grupo
          </label>
          <select
            id="filter-subcategoryId"
            value={subcategoryId}
            onChange={(event) => handleSubcategoryChange(event.target.value)}
            disabled={subcategoryOptions.length === 0}
            className="rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Todos</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>
                {subcategory.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Descrição"
          id="filter-description"
          placeholder="Buscar por descrição"
          value={description}
          onChange={(event) => handleDescriptionChange(event.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-(--color-text-muted)">Valor</label>
          <div className="flex gap-2">
            <select
              value={amountOperator}
              onChange={(event) => handleAmountOperatorChange(event.target.value)}
              className="w-1/2 rounded-xl border border-(--color-border) bg-(--color-bg) px-2 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            >
              <option value="">--</option>
              {AMOUNT_OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0,00"
              value={amountValue}
              onChange={(event) => handleAmountValueChange(event.target.value)}
              className="w-1/2 rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>
        </div>

        <Input
          label="Mês"
          id="filter-month"
          type="month"
          value={month}
          onChange={(event) => handleMonthChange(event.target.value)}
        />

        <Input
          label="Dia"
          id="filter-day"
          type="number"
          min="1"
          max="31"
          placeholder="Ex.: 15"
          value={day}
          disabled={!month}
          onChange={(event) => handleDayChange(event.target.value)}
        />
      </div>

      {hasActiveFilters && (
        <div>
          <Button type="button" variant="ghost" onClick={clearFilters} className="px-2 py-1.5 text-xs">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
