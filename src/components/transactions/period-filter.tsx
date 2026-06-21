"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";

const PERIOD_OPTIONS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "45", label: "Últimos 45 dias" },
  { value: "60", label: "Últimos 60 dias" },
  { value: "all", label: "Todo o período" },
] as const;

export function PeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasExactDate = Boolean(searchParams.get("month"));
  const activePeriod = hasExactDate ? null : searchParams.get("period") ?? "30";

  function selectPeriod(period: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("month");
    params.delete("day");
    if (period === "30") {
      params.delete("period");
    } else {
      params.set("period", period);
    }
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-(--color-text-muted)">
        {hasExactDate ? "Mostrando uma data específica (veja Filtros)" : "Mostrando lançamentos do período selecionado"}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Selecionar período dos lançamentos">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => selectPeriod(option.value)}
            aria-pressed={activePeriod === option.value}
            className={clsx(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              activePeriod === option.value
                ? "border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)"
                : "border-(--color-border) bg-(--color-surface) text-(--color-text-muted) hover:border-(--color-primary) hover:text-(--color-text)"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
