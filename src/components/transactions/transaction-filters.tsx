"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { clsx } from "clsx";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form";

type TransactionFiltersProps = {
  categories: TransactionFormCategory[];
  tags: { id: string; name: string }[];
};

const AMOUNT_OPERATORS = [
  { value: "eq", label: "Igual a" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
] as const;

export function TransactionFiltersBar({ categories, tags }: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [categoryId, setCategoryId] = useState(
    searchParams.get("categoryId") ?? "",
  );
  const [subcategoryId, setSubcategoryId] = useState(
    searchParams.get("subcategoryId") ?? "",
  );
  const [description, setDescription] = useState(
    searchParams.get("description") ?? "",
  );
  const [amountOperator, setAmountOperator] = useState(
    searchParams.get("amountOperator") ?? "",
  );
  const [amountValue, setAmountValue] = useState(
    searchParams.get("amountValue") ?? "",
  );
  const [type, setType] = useState(searchParams.get("type") ?? "");
  const [month, setMonth] = useState(searchParams.get("month") ?? "");
  const [day, setDay] = useState(searchParams.get("day") ?? "");
  const [tagIds, setTagIds] = useState<string[]>(searchParams.getAll("tagIds"));
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  const subcategoryOptions = selectedCategory?.children ?? [];

  useEffect(() => {
    if (!tagMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        setTagMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagMenuOpen]);

  type FiltersState = {
    type: string;
    categoryId: string;
    subcategoryId: string;
    description: string;
    amountOperator: string;
    amountValue: string;
    month: string;
    day: string;
    tagIds: string[];
  };

  function applyFilters(next: FiltersState) {
    const params = new URLSearchParams();
    if (next.type) params.set("type", next.type);
    if (next.categoryId) params.set("categoryId", next.categoryId);
    if (next.subcategoryId) params.set("subcategoryId", next.subcategoryId);
    if (next.description) params.set("description", next.description);
    if (next.amountOperator && next.amountValue) {
      params.set("amountOperator", next.amountOperator);
      params.set("amountValue", next.amountValue);
    }
    for (const id of next.tagIds ?? []) params.append("tagIds", id);
    if (next.month) {
      params.set("month", next.month);
      if (next.day) params.set("day", next.day);
    } else {
      const currentPeriod = searchParams.get("period");
      if (currentPeriod) params.set("period", currentPeriod);
    }
    router.replace(
      params.size > 0 ? `${pathname}?${params.toString()}` : pathname,
      { scroll: false },
    );
  }

  function scheduleApply(next: FiltersState) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyFilters(next), 350);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const currentValues = {
    type,
    categoryId,
    subcategoryId,
    description,
    amountOperator,
    amountValue,
    month,
    day,
    tagIds,
  };

  function handleTypeChange(value: string) {
    setType(value);
    applyFilters({ ...currentValues, type: value });
  }

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

  function toggleTag(id: string) {
    const next = tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id];
    setTagIds(next);
    applyFilters({ ...currentValues, tagIds: next });
  }

  function clearFilters() {
    setType("");
    setCategoryId("");
    setSubcategoryId("");
    setDescription("");
    setAmountOperator("");
    setAmountValue("");
    setMonth("");
    setDay("");
    setTagIds([]);
    router.replace(pathname, { scroll: false });
  }

  const hasActiveFilters = Boolean(
    type ||
    categoryId ||
    subcategoryId ||
    description ||
    (amountOperator && amountValue) ||
    month ||
    tagIds.length > 0,
  );

  const tagsById = new Map(tags.map((tag) => [tag.id, tag.name]));
  const selectedTagsLabel =
    tagIds.length === 0
      ? "Todas"
      : tagIds.length === 1
        ? (tagsById.get(tagIds[0]!) ?? "1 selecionada")
        : `${tagIds.length} selecionadas`;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-type"
            className="text-xs font-medium text-(--color-text-muted)"
          >
            Tipo
          </label>
          <select
            id="filter-type"
            value={type}
            onChange={(event) => handleTypeChange(event.target.value)}
            className="rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
          >
            <option value="">Todos</option>
            <option value="EXPENSE">Despesa</option>
            <option value="INCOME">Entrada</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-categoryId"
            className="text-xs font-medium text-(--color-text-muted)"
          >
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
          <label
            htmlFor="filter-subcategoryId"
            className="text-xs font-medium text-(--color-text-muted)"
          >
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
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="filter-subcategoryId"
            className="text-xs font-medium text-(--color-text-muted)"
          >
            Descrição
          </label>
          <Input
            id="filter-description"
            placeholder="Buscar por descrição"
            value={description}
            onChange={(event) => handleDescriptionChange(event.target.value)}
          />
        </div>

        <div className="relative flex flex-col gap-1.5" ref={tagMenuRef}>
          <label className="text-xs font-medium text-(--color-text-muted)">Tag</label>
          <button
            type="button"
            onClick={() => setTagMenuOpen((open) => !open)}
            aria-expanded={tagMenuOpen}
            disabled={tags.length === 0}
            className="flex items-center justify-between gap-2 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-2.5 text-left text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="min-w-0 truncate">{selectedTagsLabel}</span>
            <ChevronDown
              className={clsx(
                "h-4 w-4 shrink-0 text-(--color-text-muted) transition-transform duration-200",
                tagMenuOpen && "rotate-180",
              )}
              aria-hidden="true"
            />
          </button>

          {tagMenuOpen && (
            <div className="absolute top-full left-0 z-10 mt-1 flex max-h-56 w-full min-w-56 flex-col gap-1 overflow-y-auto rounded-xl border border-(--color-border) bg-(--color-surface) p-2 shadow-lg">
              {tagIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTagIds([]);
                    applyFilters({ ...currentValues, tagIds: [] });
                  }}
                  className="self-start px-1 py-0.5 text-xs text-(--color-text-muted) hover:text-(--color-text)"
                >
                  Limpar seleção
                </button>
              )}
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-(--color-bg)"
                >
                  <input
                    type="checkbox"
                    checked={tagIds.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="h-4 w-4 shrink-0 accent-(--color-primary)"
                  />
                  <span className="truncate text-sm text-(--color-text)">{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-(--color-text-muted)">
            Valor
          </label>
          <div className="flex gap-2">
            <select
              value={amountOperator}
              onChange={(event) =>
                handleAmountOperatorChange(event.target.value)
              }
              className="min-w-0 w-1/2 rounded-xl border border-(--color-border) bg-(--color-bg) px-2 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
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
              className="min-w-0 w-1/2 rounded-xl border border-(--color-border) bg-(--color-bg) px-3 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
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
          <Button
            type="button"
            variant="ghost"
            onClick={clearFilters}
            className="px-2 py-1.5 text-xs"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
