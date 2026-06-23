"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar exclusão",
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      ref.current?.focus();
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/40 p-4 animate-fade-grow"
      role="presentation"
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        tabIndex={-1}
        className="my-auto max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-xl outline-none animate-fade-grow"
      >
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-(--color-text)">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-(--color-text-muted)">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
