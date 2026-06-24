"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Check, CheckCircle2, Eye, Loader2, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { acceptFixedExpenseInsightAction, dismissFixedExpenseInsightAction } from "@/app/(app)/lancamentos/actions";
import type { FixedExpenseCandidate, FixedExpenseResolvedInsight, FixedExpenseTransactionDetail } from "@/lib/insights-data";

function TransactionsDetailList({ transactions }: { transactions: FixedExpenseTransactionDetail[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {transactions.map((tx) => {
        const groupLabel = tx.categoryName
          ? tx.subcategoryName
            ? `${tx.categoryName} › ${tx.subcategoryName}`
            : tx.categoryName
          : "Sem grupo";
        return (
          <li key={tx.id} className="flex flex-col gap-1 rounded-lg border border-(--color-border) px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-medium text-(--color-text)">{tx.description}</span>
              <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(tx.amount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs text-(--color-text-muted)">
              <span>{groupLabel}</span>
              <span>{formatDate(tx.date)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function candidateTitle(descriptions: string[]) {
  return descriptions.length === 1 ? descriptions[0] : `${descriptions.length} descrições diferentes`;
}

export function FixedExpenseCandidateCard({ candidate }: { candidate: FixedExpenseCandidate }) {
  const [isPending, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDismissOpen, setConfirmDismissOpen] = useState(false);

  const title = candidateTitle(candidate.descriptions);
  const { min, max } = candidate.dayOfMonthRange;
  const dayLabel = min === max ? `todo dia ${min}` : `entre os dias ${min} e ${max}`;
  const ids = candidate.transactions.map((tx) => tx.id);

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptFixedExpenseInsightAction(candidate.groupKey, ids);
      toast[result.success ? "success" : "error"](
        result.message ?? (result.success ? "Marcado como despesa fixa" : "Não foi possível marcar como despesa fixa")
      );
    });
  }

  function handleDismiss() {
    startTransition(async () => {
      const result = await dismissFixedExpenseInsightAction(candidate.groupKey, ids);
      toast[result.success ? "success" : "error"](
        result.message ?? (result.success ? "Sugestão removida" : "Não foi possível remover a sugestão")
      );
      setConfirmDismissOpen(false);
    });
  }

  return (
    <>
      <li className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-(--color-text)">{title}</p>
          <p className="mt-1 text-xs text-(--color-text-muted)">
            {candidate.amount !== null ? (
              <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(candidate.amount)}</span>
            ) : (
              "Valores variam"
            )}
            {" · "}
            recorrente em {candidate.monthsCount} meses · {dayLabel}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={handleAccept}
            disabled={isPending}
            aria-label="Aceitar como despesa fixa"
            title="Aceitar como despesa fixa"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-success) transition-colors hover:bg-(--color-success)/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            aria-label="Ver detalhes"
            title="Ver detalhes"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-text)"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDismissOpen(true)}
            disabled={isPending}
            aria-label="Remover sugestão"
            title="Remover sugestão"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </li>

      <Modal open={detailsOpen} title={title} onClose={() => setDetailsOpen(false)}>
        <TransactionsDetailList transactions={candidate.transactions} />
      </Modal>

      <ConfirmDialog
        open={confirmDismissOpen}
        title="Remover sugestão"
        description="Tem certeza que deseja remover esta sugestão de despesa fixa? Ela não vai mais aparecer aqui."
        confirmLabel="Remover"
        isLoading={isPending}
        onConfirm={handleDismiss}
        onCancel={() => setConfirmDismissOpen(false)}
      />
    </>
  );
}

export function FixedExpenseResolvedCard({ insight }: { insight: FixedExpenseResolvedInsight }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const title = candidateTitle(insight.descriptions);
  const groupLabel = insight.categoryName
    ? insight.subcategoryName
      ? `${insight.categoryName} › ${insight.subcategoryName}`
      : insight.categoryName
    : "Sem grupo";

  return (
    <>
      <li className="flex items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-success)/5 p-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-(--color-text)">{title}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--color-success)/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-(--color-success)">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Realizado
            </span>
          </div>
          <p className="mt-1 text-xs text-(--color-text-muted)">
            {insight.amount !== null ? (
              <span className="font-numeric font-medium text-(--color-text)">{formatCurrency(insight.amount)}</span>
            ) : (
              "Valores variam"
            )}
            {" · "}
            marcado como fixa em {groupLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          aria-label="Ver detalhes"
          title="Ver detalhes"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-text)"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
      </li>

      <Modal open={detailsOpen} title={title} onClose={() => setDetailsOpen(false)}>
        <TransactionsDetailList transactions={insight.transactions} />
      </Modal>
    </>
  );
}

const PAGE_SIZE = 5;

function PaginationControls({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-text) disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anterior
      </button>
      <span className="text-xs text-(--color-text-muted)">
        Página {page} de {totalPages} · {totalItems} item(ns)
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-(--color-text-muted) transition-colors hover:bg-(--color-bg) hover:text-(--color-text) disabled:cursor-not-allowed disabled:opacity-50"
      >
        Próxima
      </button>
    </div>
  );
}

export function FixedExpenseCandidatesList({ candidates }: { candidates: FixedExpenseCandidate[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(candidates.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = candidates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <ul className="mt-3 flex flex-col gap-2.5">
        {pageItems.map((candidate) => (
          <FixedExpenseCandidateCard key={candidate.groupKey} candidate={candidate} />
        ))}
      </ul>
      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        totalItems={candidates.length}
        onPageChange={setPage}
      />
    </>
  );
}

export function FixedExpenseResolvedList({ resolved }: { resolved: FixedExpenseResolvedInsight[] }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(resolved.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = resolved.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <ul className="mt-3 flex flex-col gap-2.5">
        {pageItems.map((insight) => (
          <FixedExpenseResolvedCard key={insight.groupKey} insight={insight} />
        ))}
      </ul>
      <PaginationControls
        page={currentPage}
        totalPages={totalPages}
        totalItems={resolved.length}
        onPageChange={setPage}
      />
    </>
  );
}
