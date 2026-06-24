"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { MockCategory } from "@/lib/wish-mock-data";

type Step = "input" | "review";
type ParsedLine = { index: number; name: string; amount: number; raw: string; error?: string };

type WishPreviewBulkModalProps = {
  open: boolean;
  categories: MockCategory[];
  onClose: () => void;
  onAddMany: (input: { name: string; estimatedAmount: number; categoryId: string; subcategoryId: string }[]) => void;
};

function parseLines(text: string): ParsedLine[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw, index) => {
      const match = raw.match(/^(.*?)[-–,]\s*(?:R\$\s*)?([\d.,]+)\s*$/);
      if (!match) return { index, raw, name: raw, amount: 0, error: "Não foi possível identificar o valor" };
      const name = match[1].trim();
      const amount = Number(match[2].replace(/\./g, "").replace(",", ".")) || 0;
      if (!name) return { index, raw, name, amount, error: "Nome do desejo não encontrado" };
      if (amount <= 0) return { index, raw, name, amount, error: "Valor inválido" };
      return { index, raw, name, amount };
    });
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  const toneClass = tone === "success" ? "text-(--color-success)" : tone === "danger" ? "text-(--color-danger)" : "text-(--color-text)";
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-3">
      <span className="text-xs text-(--color-text-muted)">{label}</span>
      <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

export function WishPreviewBulkModal({ open, categories, onClose, onAddMany }: WishPreviewBulkModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const subcategoryOptions = categories.find((category) => category.id === categoryId)?.children ?? [];

  const allParsed = useMemo(() => parseLines(text), [text]);
  const parsed = useMemo(() => allParsed.filter((line) => !removedIndexes.has(line.index)), [allParsed, removedIndexes]);
  const validRows = parsed.filter((line) => !line.error);
  const invalidRows = parsed.filter((line) => line.error);

  function reset() {
    setStep("input");
    setText("");
    setFileName("");
    setCategoryId("");
    setSubcategoryId("");
    setRemovedIndexes(new Set());
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveRow(index: number) {
    setRemovedIndexes((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  function handleConfirm() {
    if (!categoryId || !subcategoryId || validRows.length === 0) return;
    onAddMany(validRows.map((line) => ({ name: line.name, estimatedAmount: line.amount, categoryId, subcategoryId })));
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Adicionar desejos em lote"
      size="lg"
      onClose={() => {
        reset();
        onClose();
      }}
    >
      {step === "input" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-(--color-border) py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
              <Upload className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-(--color-text)">Envie um arquivo .csv ou .txt</p>
              <p className="mt-1 text-xs text-(--color-text-muted)">Uma linha por desejo, no formato &quot;Nome - Valor&quot;</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              id="bulk-wish-file-input"
              onChange={handleFileChange}
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Selecionar arquivo
            </Button>
            {fileName && <p className="text-xs text-(--color-text-muted)">Arquivo carregado: {fileName}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-(--color-text)">Ou cole uma linha por desejo</label>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFileName("");
              }}
              placeholder={"Fone de ouvido - 150\nNotebook novo - 4500\nCurso de inglês - 800"}
              className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) placeholder:text-(--color-text-muted) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
            />
          </div>

          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setRemovedIndexes(new Set());
                setStep("review");
              }}
              disabled={allParsed.length === 0}
            >
              Pré-visualizar {allParsed.length > 0 ? `(${allParsed.length})` : ""}
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Linhas" value={String(parsed.length)} />
            <StatCard label="Válidas" value={String(validRows.length)} tone="success" />
            <StatCard label="Com erro" value={String(invalidRows.length)} tone={invalidRows.length > 0 ? "danger" : undefined} />
          </div>

          <div className="overflow-x-auto rounded-xl border border-(--color-border)">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-(--color-border) bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
                  <th scope="col" className="px-3 py-2">Status</th>
                  <th scope="col" className="px-3 py-2">Nome</th>
                  <th scope="col" className="px-3 py-2">Valor</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((line) => (
                  <tr key={line.index} className="border-b border-(--color-border) last:border-0">
                    <td className="px-3 py-2">
                      {line.error ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-(--color-danger)">
                          <AlertTriangle size={14} aria-hidden="true" />
                          {line.error}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-(--color-success)">
                          <CheckCircle2 size={14} aria-hidden="true" />
                          OK
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-(--color-text)">{line.name || line.raw}</td>
                    <td className="px-3 py-2 font-numeric text-(--color-text)">
                      {line.amount > 0 ? formatCurrency(line.amount) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(line.index)}
                        title="Remover linha"
                        aria-label="Remover linha"
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-(--color-text-muted) transition-colors hover:bg-(--color-danger)/10 hover:text-(--color-danger) cursor-pointer"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {validRows.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-(--color-border) py-6 text-center">
              <AlertTriangle className="h-5 w-5 text-(--color-danger)" aria-hidden="true" />
              <p className="text-sm text-(--color-text-muted)">Nenhuma linha válida para cadastrar. Volte e ajuste o conteúdo.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-(--color-text)">Grupo (aplicado a todos)</label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20"
              >
                <option value="">Selecione um grupo</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-(--color-text)">Sub-grupo (aplicado a todos)</label>
              <select
                key={categoryId}
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                disabled={subcategoryOptions.length === 0}
                className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione um sub-grupo</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>
                    {subcategory.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep("input")}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Voltar
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={!categoryId || !subcategoryId || validRows.length === 0}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Cadastrar {validRows.length} desejo{validRows.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
