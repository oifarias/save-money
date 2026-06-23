"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, CheckCircle2, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatCurrency, formatDate } from "@/lib/format";
import { PayFixedExpensesForm } from "@/components/transactions/pay-fixed-expenses-form";
import type { FixedExpenseChecklistItem } from "@/lib/fixed-expenses-data";

type FixedExpensesChecklistProps = {
  items: FixedExpenseChecklistItem[];
};

export function FixedExpensesChecklist({ items }: FixedExpensesChecklistProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [expanded, setExpanded] = useState(true);

  function toggleSelect(templateId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(templateId)) {
        next.delete(templateId);
      } else {
        next.add(templateId);
      }
      return next;
    });
  }

  function closePayModal() {
    setPayModalOpen(false);
    setSelectedIds(new Set());
  }

  if (items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 py-12 text-center">
        <ClipboardList className="h-8 w-8 text-(--color-text-muted)" aria-hidden="true" />
        <p className="font-display text-lg font-semibold text-(--color-text)">Nenhuma despesa fixa cadastrada</p>
        <p className="max-w-sm text-sm text-(--color-text-muted)">
          Marque um lançamento como despesa fixa para acompanhar aqui quais já foram pagas no mês.
        </p>
      </Card>
    );
  }

  const selectedItems = items.filter((item) => selectedIds.has(item.templateId));
  const selectedCount = selectedItems.length;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls="despesas-fixas-content"
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="font-display text-xl font-semibold text-(--color-text)">Despesas fixas do mês</h2>
          <p className="mt-1 text-sm text-(--color-text-muted)">
            Acompanhe o que já foi pago e marque pendências como pagas
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-(--color-text-muted) transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        id="despesas-fixas-content"
        className={`flex flex-col gap-4 overflow-hidden transition-all duration-200 ${expanded ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        {selectedCount > 0 && (
          <div
            aria-live="polite"
            className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--color-primary)/30 bg-(--color-primary)/10 px-4 py-3"
          >
            <p className="text-sm font-medium text-(--color-text)">{selectedCount} selecionado(s)</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
              <Button type="button" onClick={() => setPayModalOpen(true)}>
                Marcar como pago ({selectedCount})
              </Button>
            </div>
          </div>
        )}

        <Card className="divide-y divide-(--color-border) p-0">
          {items.map((item) => {
            const isPaid = item.status === "paid";
            return (
              <div key={item.templateId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.templateId)}
                  onChange={() => toggleSelect(item.templateId)}
                  disabled={isPaid}
                  aria-label={`Selecionar ${item.description}`}
                  className="h-4 w-4 shrink-0 rounded border-(--color-border) accent-(--color-primary) disabled:cursor-not-allowed disabled:opacity-40"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-(--color-text)">{item.description}</p>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">
                    {item.categoryName ?? "Sem grupo"}
                    {" · "}
                    {isPaid && item.paidDate ? `Pago em ${formatDate(item.paidDate)}` : `Vence dia ${item.dueDay}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-numeric text-sm font-semibold text-(--color-text)">
                    {formatCurrency(isPaid ? item.paidAmount ?? 0 : item.expectedAmount)}
                  </span>
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-(--color-success)/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-success)">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Pago
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-(--color-accent)/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      Pendente
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <Modal
        open={payModalOpen}
        title={`Marcar ${selectedCount} despesa${selectedCount === 1 ? "" : "s"} como paga${selectedCount === 1 ? "" : "s"}`}
        onClose={closePayModal}
      >
        <PayFixedExpensesForm items={selectedItems} onDone={closePayModal} />
      </Modal>
    </div>
  );
}
