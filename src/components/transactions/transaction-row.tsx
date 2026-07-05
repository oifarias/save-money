"use client";

import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { IconBadge } from "@/components/ui/icon-badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { BankIcon, getBankByCode } from "@/lib/bank-icons";
import type { TransactionListItem } from "@/components/transactions/transaction-list";

type TransactionRowProps = {
  transaction: TransactionListItem;
  onEdit: (transaction: TransactionListItem) => void;
  onDelete: (transaction: TransactionListItem) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

function renderCategoryIcon(icon: string, color: string) {
  const Icon = getCategoryIcon(icon);
  return <Icon className="h-3 w-3" aria-hidden="true" style={{ color }} />;
}

const MONTH_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-green-100 text-green-700",
  "bg-amber-100 text-amber-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-indigo-100 text-indigo-700",
  "bg-red-100 text-red-700",
  "bg-slate-100 text-slate-600",
  "bg-fuchsia-100 text-fuchsia-700",
];

export function TransactionRow({ transaction, onEdit, onDelete, selectable, selected, onToggleSelect }: TransactionRowProps) {
  const isExpense = transaction.type === "EXPENSE";
  const monthIndex = new Date(transaction.date).getMonth();
  const monthColor = MONTH_COLORS[monthIndex];

  return (
    <div className="grid grid-cols-[1fr_8rem_13rem] items-center gap-4 px-4 py-3.5 sm:px-5">
      {/* Esquerda: checkbox + ícone + descrição */}
      <div className="flex min-w-0 items-center gap-3">
        {selectable && (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={() => onToggleSelect?.(transaction.id)}
            aria-label={`Selecionar lançamento ${transaction.description}`}
            className="h-4 w-4 shrink-0 rounded border-(--color-border) accent-(--color-primary)"
          />
        )}

        <IconBadge
          icon={isExpense ? ArrowUpRight : ArrowDownLeft}
          colorToken={isExpense ? "--color-danger" : "--color-success"}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-(--color-text)">{transaction.description}</p>
            {transaction.isFixed && <StatusBadge label="Fixa" variant="accent" />}
            {transaction.installment && (
              <StatusBadge
                label={`Parcela ${transaction.installment.number}/${transaction.installment.total}`}
                variant="primary"
              />
            )}
            {transaction.recurrence !== "NONE" && (
              <Repeat className="h-3.5 w-3.5 shrink-0 text-(--color-text-muted)" aria-label="Lançamento recorrente" />
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--color-text-muted)">
            <span>{formatDate(transaction.date)}</span>
            {transaction.category && (
              <span className="flex items-center gap-1">
                {renderCategoryIcon(transaction.category.icon, transaction.category.color)}
                {transaction.category.name}
                {transaction.subcategory && ` › ${transaction.subcategory.name}`}
              </span>
            )}
            {transaction.tags.map((tag) => (
              <span key={tag} className="text-(--color-primary)">
                #{tag}
              </span>
            ))}
            {transaction.creditCard && (
              <span className="flex items-center gap-1">
                <BankIcon bankCode={transaction.creditCard.bankCode} size="sm" />
                <span>
                  {transaction.creditCard.nickname ??
                    getBankByCode(transaction.creditCard.bankCode)?.name ??
                    transaction.creditCard.bankCode}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Centro: mês */}
      <div className="hidden justify-center sm:flex">
        <span className={clsx("capitalize rounded-full px-3 py-1 text-xs font-medium", monthColor)}>
          {new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(transaction.date))}
        </span>
      </div>

      {/* Direita: valor + ações */}
      <div className="flex items-center justify-end gap-3">
        <p
          className={clsx(
            "whitespace-nowrap font-numeric text-sm font-semibold",
            isExpense ? "text-(--color-danger)" : "text-(--color-success)"
          )}
        >
          {isExpense ? "-" : "+"} <Money value={transaction.amount} />
        </p>

        <div className="flex gap-1">
          <IconActionButton
            icon={Pencil}
            label={`Editar lançamento ${transaction.description}`}
            hoverVariant="primary"
            onClick={() => onEdit(transaction)}
          />
          <IconActionButton
            icon={Trash2}
            label={`Excluir lançamento ${transaction.description}`}
            hoverVariant="danger"
            onClick={() => onDelete(transaction)}
          />
        </div>
      </div>
    </div>
  );
}
