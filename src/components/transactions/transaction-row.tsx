"use client";

import { clsx } from "clsx";
import { ArrowDownLeft, ArrowUpRight, Pencil, Repeat, Trash2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { IconBadge } from "@/components/ui/icon-badge";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { StatusBadge } from "@/components/ui/status-badge";
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
        </div>
      </div>

      <p
        className={clsx(
          "shrink-0 font-numeric text-sm font-semibold",
          isExpense ? "text-(--color-danger)" : "text-(--color-success)"
        )}
      >
        {isExpense ? "-" : "+"} <Money value={transaction.amount} />
      </p>

      <div className="flex shrink-0 gap-1">
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
  );
}
