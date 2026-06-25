import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CreditCard, PiggyBank } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { clsx } from "clsx";
import type { FixedExpenseTemplatesTotals } from "@/lib/dashboard-data";

type SummaryCardsProps = {
  income: number;
  expense: number;
  balance: number;
  installments: { currentMonth: number; remaining: number };
  /** Mês atual no formato "YYYY-MM", usado para linkar o card de parcelamentos ao mesmo período exibido no card. */
  currentMonthKey?: string;
  periodLabel?: string;
  fixedExpenseTemplates: FixedExpenseTemplatesTotals;
};

export function SummaryCards({
  income,
  expense,
  balance,
  installments,
  currentMonthKey,
  periodLabel = "do mês",
  fixedExpenseTemplates,
}: SummaryCardsProps) {
  const fixedExpenseTotal = fixedExpenseTemplates.pendingTotal + fixedExpenseTemplates.paidTotal;
  const installmentsCard = (
    <Card className="flex items-start justify-between border-(--color-primary)/30 bg-gradient-to-br from-(--color-primary)/10 to-transparent transition-shadow hover:shadow-md">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-(--color-primary)">Total de parcelamentos</p>
        <p className="mt-2 font-numeric text-xl font-semibold text-(--color-text) sm:text-2xl">
          {formatCurrency(installments.currentMonth)}
        </p>
        <p className="mt-1 text-xs text-(--color-text-muted)">
          {installments.remaining > 0
            ? `Faltam ${formatCurrency(installments.remaining)} em parcelas futuras`
            : "Nenhuma parcela pendente"}
        </p>
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-primary)/15 text-(--color-primary)">
        <CreditCard className="h-5 w-5" aria-hidden="true" />
      </span>
    </Card>
  );
  const cards = [
    {
      id: "income",
      label: `Entradas ${periodLabel}`,
      value: income,
      icon: ArrowDownLeft,
      tone: "text-(--color-success)",
      bg: "bg-(--color-success)/10",
    },
    {
      id: "expense",
      label: `Despesas ${periodLabel}`,
      value: expense,
      icon: ArrowUpRight,
      tone: "text-(--color-danger)",
      bg: "bg-(--color-danger)/10",
    },
    {
      id: "balance",
      label: "Saldo líquido",
      value: balance,
      icon: PiggyBank,
      tone: balance >= 0 ? "text-(--color-success)" : "text-(--color-danger)",
      bg: balance >= 0 ? "bg-(--color-success)/10" : "bg-(--color-danger)/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.id} className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">{card.label}</p>
              <p className={clsx("mt-2 font-numeric text-xl font-semibold sm:text-2xl", card.tone)}>
                {formatCurrency(card.value)}
              </p>
            </div>
            <span className={clsx("flex h-10 w-10 items-center justify-center rounded-xl", card.bg, card.tone)}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          </Card>
        );
      })}

      {currentMonthKey ? (
        <Link href={`/lancamentos?month=${currentMonthKey}`} className="block">
          {installmentsCard}
        </Link>
      ) : (
        installmentsCard
      )}

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-text-muted)">Despesas fixas (mês)</p>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
            <CalendarCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-numeric text-2xl font-semibold text-(--color-text)">{formatCurrency(fixedExpenseTotal)}</span>
          <span className="text-xs text-(--color-text-muted)">(Total)</span>
        </div>
        <div className="border-t border-(--color-border)" />
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
    </div>
  );
}
