import { ArrowDownLeft, ArrowUpRight, CreditCard, PiggyBank, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { clsx } from "clsx";

type SummaryCardsProps = {
  income: number;
  expense: number;
  balance: number;
  fixedExpense: number;
  installments: { currentMonth: number; remaining: number };
  periodLabel?: string;
};

export function SummaryCards({
  income,
  expense,
  balance,
  fixedExpense,
  installments,
  periodLabel = "do mês",
}: SummaryCardsProps) {
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

      <Card className="flex items-start justify-between border-(--color-accent)/30 bg-gradient-to-br from-(--color-accent)/10 to-transparent">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-(--color-accent)">Despesas fixas</p>
          <p className="mt-2 font-numeric text-xl font-semibold text-(--color-text) sm:text-2xl">
            {formatCurrency(fixedExpense)}
          </p>
          <p className="mt-1 text-xs text-(--color-text-muted)">
            {expense > 0 ? `${((fixedExpense / expense) * 100).toFixed(0)}% das despesas ${periodLabel}` : "Nenhuma despesa registrada"}
          </p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-accent)/15 text-(--color-accent)">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </span>
      </Card>

      <Card className="flex items-start justify-between border-(--color-primary)/30 bg-gradient-to-br from-(--color-primary)/10 to-transparent">
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
    </div>
  );
}
