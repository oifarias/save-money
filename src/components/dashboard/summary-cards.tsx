import Link from "next/link";
import { type LucideIcon, ArrowDownLeft, ArrowUpRight, CalendarCheck, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import type { FixedExpenseTemplatesTotals, IncomeBreakdown, ExpenseBreakdown } from "@/lib/dashboard-data";

type SummaryCardsProps = {
  income: number;
  expense: number;
  installments: { currentMonth: number; currentMonthCount: number; remaining: number; lastInstallmentPlansCount: number; lastInstallmentAmount: number };
  /** Mês atual no formato "YYYY-MM", usado para linkar os cards ao mesmo período exibido neles, quando `filterParams` não é informado. */
  currentMonthKey?: string;
  /** Filtros atualmente aplicados em /lancamentos (period, month, categoryId, etc.), preservados ao clicar nos cards. */
  filterParams?: { toString(): string };
  periodLabel?: string;
  fixedExpenseTemplates: FixedExpenseTemplatesTotals;
  incomeBreakdown: IncomeBreakdown;
  expenseBreakdown: ExpenseBreakdown;
};

type CardClasses = {
  text: string;
  iconBg: string;
  border: string;
  gradient: string;
  divider: string;
};

type SummaryCardProps = {
  title: string;
  href: string;
  icon: LucideIcon;
  classes: CardClasses;
  total: number;
  left: { label: string; value: number | string };
  right: { label: string; value: number | string };
};

function SummaryCard({ title, href, icon: Icon, classes, total, left, right }: SummaryCardProps) {
  return (
    <Link href={href} className="block">
      <Card className={`flex flex-col gap-2 p-4 ${classes.border} ${classes.gradient} transition-shadow hover:shadow-md`}>
        <div className="flex items-center justify-between">
          <p className={`text-xs font-medium uppercase tracking-wide ${classes.text}`}>{title}</p>
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${classes.iconBg} ${classes.text}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-numeric text-2xl font-semibold text-(--color-text)">
            <Money value={total} />
          </span>
          <span className="text-xs text-(--color-text-muted)">(Total)</span>
        </div>
        <div className={`border-t ${classes.divider}`} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-(--color-text)">{left.label}</p>
            <p className={`font-numeric text-sm font-semibold ${classes.text}`}>
              {typeof left.value === "number" ? <Money value={left.value} /> : left.value}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-(--color-text)">{right.label}</p>
            <p className={`font-numeric text-sm font-semibold ${classes.text}`}>
              {typeof right.value === "number" ? <Money value={right.value} /> : right.value}
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

const CARD_COLORS = {
  success: {
    text: "text-(--color-success)",
    iconBg: "bg-(--color-success)/15",
    border: "border-(--color-success)/30",
    gradient: "bg-gradient-to-br from-(--color-success)/10 to-transparent",
    divider: "border-(--color-success)/20",
  },
  danger: {
    text: "text-(--color-danger)",
    iconBg: "bg-(--color-danger)/15",
    border: "border-(--color-danger)/30",
    gradient: "bg-gradient-to-br from-(--color-danger)/10 to-transparent",
    divider: "border-(--color-danger)/20",
  },
  blue: {
    text: "text-blue-500",
    iconBg: "bg-blue-500/15",
    border: "border-blue-500/30",
    gradient: "bg-gradient-to-br from-blue-500/10 to-transparent",
    divider: "border-blue-500/20",
  },
  accent: {
    text: "text-(--color-accent)",
    iconBg: "bg-(--color-accent)/15",
    border: "border-(--color-accent)/30",
    gradient: "bg-gradient-to-br from-(--color-accent)/10 to-transparent",
    divider: "border-(--color-accent)/20",
  },
} satisfies Record<string, CardClasses>;

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
  const lastInstallmentCount = installments.lastInstallmentPlansCount;

  const cards: SummaryCardProps[] = [
    {
      title: `Entradas ${periodLabel}`,
      href: buildFilterHref(baseParams, { type: "INCOME" }),
      icon: ArrowDownLeft,
      classes: CARD_COLORS.success,
      total: income,
      left: { label: `Entrada fixa (${incomeBreakdown.fixedCount})`, value: incomeBreakdown.fixedTotal },
      right: { label: `Entrada variável (${incomeBreakdown.variableCount})`, value: incomeBreakdown.variableTotal },
    },
    {
      title: `Despesas ${periodLabel}`,
      href: buildFilterHref(baseParams, { type: "EXPENSE" }),
      icon: ArrowUpRight,
      classes: CARD_COLORS.danger,
      total: expense,
      left: { label: `Saída fixa (${expenseBreakdown.fixedCount})`, value: expenseBreakdown.fixedTotal },
      right: { label: `Saída variável (${expenseBreakdown.variableCount})`, value: expenseBreakdown.variableTotal },
    },
    {
      title: "Total de parcelamentos",
      href: buildFilterHref(baseParams, { installment: "true" }),
      icon: CreditCard,
      classes: CARD_COLORS.blue,
      total: installments.currentMonth,
      left: { label: "Continua próx. mês", value: installments.remaining },
      right: { label: `Última parcela (${lastInstallmentCount})`, value: installments.lastInstallmentAmount },
    },
    {
      title: "Despesas fixas (mês)",
      href: buildFilterHref(baseParams, { isFixed: "true" }),
      icon: CalendarCheck,
      classes: CARD_COLORS.accent,
      total: fixedExpenseTotal,
      left: { label: `Pendente (${fixedExpenseTemplates.pendingCount})`, value: fixedExpenseTemplates.pendingTotal },
      right: { label: `Pago (${fixedExpenseTemplates.paidCount})`, value: fixedExpenseTemplates.paidTotal },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <SummaryCard key={card.title} {...card} />
      ))}
    </div>
  );
}
