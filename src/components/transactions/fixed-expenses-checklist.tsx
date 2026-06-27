"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { SelectionBar } from "@/components/ui/selection-bar";
import { formatDate } from "@/lib/format";
import { Money } from "@/components/ui/money";
import { PayFixedExpensesForm } from "@/components/transactions/pay-fixed-expenses-form";
import type { FixedExpenseChecklistItem } from "@/lib/fixed-expenses-data";

type FixedExpensesChecklistProps = {
  items: FixedExpenseChecklistItem[];
};

export function FixedExpensesChecklist({ items }: FixedExpensesChecklistProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payModalOpen, setPayModalOpen] = useState(false);

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

  function editAndPay(templateId: string) {
    setSelectedIds(new Set([templateId]));
    setPayModalOpen(true);
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
      <CollapsibleSection
        title="Despesas fixas do mês"
        description="Acompanhe o que já foi pago e marque pendências como pagas"
      >
        <SelectionBar count={selectedCount}>
          <Button type="button" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
          <Button type="button" onClick={() => setPayModalOpen(true)}>
            Marcar como pago ({selectedCount})
          </Button>
        </SelectionBar>

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
                    <Money value={isPaid ? item.paidAmount ?? 0 : item.expectedAmount} />
                  </span>
                  {isPaid ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-(--color-success)/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-success)">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Pago
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => editAndPay(item.templateId)}
                        title="Editar valor e marcar como pago"
                        aria-label={`Editar valor e marcar ${item.description} como pago`}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-primary)/10 hover:text-(--color-primary) cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span className="inline-flex items-center gap-1 rounded-full bg-(--color-accent)/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--color-accent)">
                        <CalendarClock className="h-3 w-3" aria-hidden="true" />
                        Pendente
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </CollapsibleSection>

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
