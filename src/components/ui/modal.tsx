"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg";
};

export function Modal({ open, title, onClose, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) ref.current?.focus();
    // Foca o container apenas na transição de fechado -> aberto; refazer isso em todo
    // re-render (ex.: a cada tecla digitada num input do modal) rouba o foco do campo ativo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-black/40 sm:p-4 animate-fade-grow"
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`my-auto max-h-[100dvh] w-full overflow-y-auto rounded-none border-(--color-border) bg-(--color-surface) p-6 shadow-xl outline-none animate-fade-grow sm:max-h-[90dvh] sm:rounded-2xl sm:border ${
          size === "lg" ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="font-display text-lg font-semibold text-(--color-text)">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--color-text-muted) hover:bg-(--color-bg)"
          >
            <X className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
