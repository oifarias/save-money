import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { FixedExpenseTemplatesTotals, IncomeBreakdown, ExpenseBreakdown } from "@/lib/dashboard-data";

type SummaryCardsProps = {
  income: number;
  expense: number;
  installments: { currentMonth: number; currentMonthCount: number; remaining: number; lastInstallmentPlansCount: number };
  /** Mês atual no formato "YYYY-MM", usado para linkar os cards ao mesmo período exibido neles, quando `filterParams` não é informado. */
  currentMonthKey?: string;
  /** Filtros atualmente aplicados em /lancamentos (period, month, categoryId, etc.), preservados ao clicar nos cards. */
  filterParams?: { toString(): string };
  periodLabel?: string;
  fixedExpenseTemplates: FixedExpenseTemplatesTotals;
  incomeBreakdown: IncomeBreakdown;
  expenseBreakdown: ExpenseBreakdown;
};

function buildFilterHref(base: { toString(): string } | undefined, overrides: Record<string, string>) {
  const params = new URLSearchParams(base?.toString() ?? "");
  params.delete("type");
  params.delete("isFixed");
  params.delete("installment");
  for (const [key, value] of Object.entries(overrides)) {
    params.set(key, value);
  }
  const query = params.toString();
  return query ? `/lancamentos?${query}` : "/lancamentos";
}

export function SummaryCards({
  income,
  expense,
  installments,
  currentMonthKey,
  filterParams,
  periodLabel = "do mês",
  fixedExpenseTemplates,
  incomeBreakdown,
  expenseBreakdown,
}: SummaryCardsProps) {
  const baseParams = filterParams ?? (currentMonthKey ? new URLSearchParams({ month: currentMonthKey }) : new URLSearchParams());
  const fixedExpenseTotal = fixedExpenseTemplates.pendingTotal + fixedExpenseTemplates.paidTotal;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

      {/* Card Entradas */}
      <Link href={buildFilterHref(baseParams, { type: "INCOME" })} className="block">
        <Card className="flex flex-col gap-3 border-(--color-success)/30 bg-gradient-to-br from-(--color-success)/10 to-transparent transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-(--color-success)">Entradas {periodLabel}</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-success)/15 text-(--color-success)">
              <ArrowDownLeft className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-numeric text-2xl font-semibold text-(--color-text)">{formatCurrency(income)}</span>
            <span className="text-xs text-(--color-text-muted)">(Total)</span>
          </div>
          <div className="border-t border-(--color-success)/20" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-(--color-text)">Entrada fixa ({incomeBreakdown.fixedCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-success)">{formatCurrency(incomeBreakdown.fixedTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text)">Entrada variável ({incomeBreakdown.variableCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-success)">{formatCurrency(incomeBreakdown.variableTotal)}</p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Card Despesas */}
      <Link href={buildFilterHref(baseParams, { type: "EXPENSE" })} className="block">
        <Card className="flex flex-col gap-3 border-(--color-danger)/30 bg-gradient-to-br from-(--color-danger)/10 to-transparent transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-(--color-danger)">Despesas {periodLabel}</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-danger)/15 text-(--color-danger)">
              <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-numeric text-2xl font-semibold text-(--color-text)">{formatCurrency(expense)}</span>
            <span className="text-xs text-(--color-text-muted)">(Total)</span>
          </div>
          <div className="border-t border-(--color-danger)/20" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-(--color-text)">Saída fixa ({expenseBreakdown.fixedCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-danger)">{formatCurrency(expenseBreakdown.fixedTotal)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text)">Saída variável ({expenseBreakdown.variableCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-danger)">{formatCurrency(expenseBreakdown.variableTotal)}</p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Card Parcelamentos */}
      <Link href={buildFilterHref(baseParams, { installment: "true" })} className="block">
        <Card className="flex flex-col gap-3 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-transparent transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-500">Total de parcelamentos</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-500">
              <CreditCard className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-numeric text-2xl font-semibold text-(--color-text)">{formatCurrency(installments.currentMonth)}</span>
            <span className="text-xs text-(--color-text-muted)">(Total)</span>
          </div>
          <div className="border-t border-blue-500/20" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-(--color-text)">Pendentes ({installments.currentMonthCount})</p>
              <p className="font-numeric text-sm font-semibold text-blue-500">{formatCurrency(installments.currentMonth)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text)">Última parcela ({installments.lastInstallmentPlansCount})</p>
              <p className="font-numeric text-sm font-semibold text-blue-400">
                {installments.lastInstallmentPlansCount > 0 ? `${installments.lastInstallmentPlansCount} plano${installments.lastInstallmentPlansCount > 1 ? "s" : ""}` : "—"}
              </p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Card Despesas Fixas */}
      <Link href={buildFilterHref(baseParams, { isFixed: "true" })} className="block">
        <Card className="flex flex-col gap-3 border-(--color-accent)/30 bg-gradient-to-br from-(--color-accent)/10 to-transparent transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-(--color-accent)">Despesas fixas (mês)</p>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-numeric text-2xl font-semibold text-(--color-text)">{formatCurrency(fixedExpenseTotal)}</span>
            <span className="text-xs text-(--color-text-muted)">(Total)</span>
          </div>
          <div className="border-t border-(--color-accent)/20" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-(--color-text)">Pendente ({fixedExpenseTemplates.pendingCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-accent)">
                {formatCurrency(fixedExpenseTemplates.pendingTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-(--color-text)">Pago ({fixedExpenseTemplates.paidCount})</p>
              <p className="font-numeric text-sm font-semibold text-(--color-success)">
                {formatCurrency(fixedExpenseTemplates.paidTotal)}
              </p>
            </div>
          </div>
        </Card>
      </Link>

    </div>
  );
}
