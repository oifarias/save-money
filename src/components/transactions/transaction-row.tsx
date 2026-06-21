"use client";

import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatCurrency, formatDate } from "@/lib/format";
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

export function TransactionRow({ transaction, onEdit, onDelete, selectable, selected, onToggleSelect }: TransactionRowProps) {
  const isExpense = transaction.type === "EXPENSE";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
      {selectable && (
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onChange={() => onToggleSelect?.(transaction.id)}
          aria-label={`Selecionar lançamento ${transaction.description}`}
          className="h-4 w-4 shrink-0 rounded border-(--color-border) accent-(--color-primary)"
        />
      )}

      <span
        className={clsx(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          isExpense ? "bg-(--color-danger)/10 text-(--color-danger)" : "bg-(--color-success)/10 text-(--color-success)"
        )}
      >
        {isExpense ? (
          <ArrowUpRight className="h-4.5 w-4.5" aria-hidden="true" />
        ) : (
          <ArrowDownLeft className="h-4.5 w-4.5" aria-hidden="true" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-(--color-text)">{transaction.description}</p>
          {transaction.isFixed && (
            <span className="shrink-0 rounded-full bg-(--color-accent)/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
              Fixa
            </span>
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
        </div>
      </div>

      <p
        className={clsx(
          "shrink-0 font-numeric text-sm font-semibold",
          isExpense ? "text-(--color-danger)" : "text-(--color-success)"
        )}
      >
        {isExpense ? "-" : "+"} {formatCurrency(transaction.amount)}
      </p>

      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          aria-label={`Editar lançamento ${transaction.description}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-primary)"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(transaction)}
          aria-label={`Excluir lançamento ${transaction.description}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-danger)"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
