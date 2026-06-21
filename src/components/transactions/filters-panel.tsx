"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionFiltersBar } from "@/components/transactions/transaction-filters";
import { PeriodFilter } from "@/components/transactions/period-filter";
import type { TransactionFormCategory } from "@/components/transactions/transaction-form";

const ADVANCED_FILTER_KEYS = ["categoryId", "subcategoryId", "description", "amountOperator", "month"];

type FiltersPanelProps = {
  categories: TransactionFormCategory[];
  actions?: ReactNode;
};

export function FiltersPanel({ categories, actions }: FiltersPanelProps) {
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeAdvancedFilterCount = ADVANCED_FILTER_KEYS.filter((key) => searchParams.get(key)).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PeriodFilter />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-label="Filtros"
            title="Filtros"
            className="px-2"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            {activeAdvancedFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--color-primary) text-[11px] font-semibold text-white">
                {activeAdvancedFilterCount}
              </span>
            )}
          </Button>
          {actions}
        </div>
      </div>

      {filtersOpen && <TransactionFiltersBar categories={categories} />}
    </div>
  );
}
