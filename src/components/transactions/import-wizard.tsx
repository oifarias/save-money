"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Trash2,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importRowSchema, IMPORT_FIELDS, type ImportFieldKey } from "@/lib/validations/import";
import {
  normalizeAmount,
  normalizeDate,
  normalizeType,
  summarizeMappedRows,
  type ParsedSheet,
  type ExistingCategoryRef,
} from "@/lib/import-helpers";
import { formatCurrency } from "@/lib/format";
import { importTransactionsAction } from "@/app/(app)/lancamentos/import-actions";

type Step = "upload" | "map" | "result";

type MappedRow = {
  index: number;
  date: string;
  description: string;
  amount: string;
  type: string;
  category: string;
  subcategory: string;
  tags: string;
  error?: string;
};

const NONE = "__none__";
const REQUIRED_FIELDS = IMPORT_FIELDS.filter((field) => field.required);
const PAGE_SIZE = 25;

type EditableField = "category" | "subcategory" | "tags";
type RowFilter = "all" | "valid" | "invalid";

function selectClass() {
  return "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20";
}

function SummaryStat({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "success" ? "text-(--color-success)" : tone === "danger" ? "text-(--color-danger)" : "text-(--color-text)";

  const baseClass = "flex flex-col gap-1 rounded-xl border bg-(--color-bg) px-3.5 py-3 text-left transition-colors";
  const borderClass = active
    ? "border-(--color-primary) ring-2 ring-(--color-primary)/20"
    : "border-(--color-border)";

  if (!onClick) {
    return (
      <div className={`${baseClass} ${borderClass}`}>
        <span className="text-xs text-(--color-text-muted)">{label}</span>
        <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClass} ${borderClass} cursor-pointer hover:border-(--color-primary)`}
    >
      <span className="text-xs text-(--color-text-muted)">{label}</span>
      <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
    </button>
  );
}

function EditableCellInput({
  value,
  onConfirm,
  onCancel,
}: {
  value: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onConfirm(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onConfirm(draft);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      className="px-2 py-1 text-sm"
    />
  );
}

function EditableCell({
  value,
  isEditing,
  onStartEdit,
  onConfirm,
  onCancel,
}: {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return <EditableCellInput value={value} onConfirm={onConfirm} onCancel={onCancel} />;
  }

  return (
    <button
      type="button"
      onClick={onStartEdit}
      className="group inline-flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-(--color-bg) cursor-pointer"
    >
      <span>{value || "—"}</span>
      <Pencil
        size={12}
        className="text-(--color-text-muted) opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

function buildMappedRows(sheet: ParsedSheet, mapping: Record<ImportFieldKey, string>): MappedRow[] {
  const columnIndex = Object.fromEntries(
    IMPORT_FIELDS.map((field) => [
      field.key,
      mapping[field.key] === NONE ? -1 : sheet.headers.indexOf(mapping[field.key]),
    ])
  ) as Record<ImportFieldKey, number>;

  return sheet.rows.map((row, index) => {
    const rawDate = columnIndex.date >= 0 ? row[columnIndex.date] : "";
    const rawDescription = columnIndex.description >= 0 ? row[columnIndex.description] : "";
    const rawAmount = columnIndex.amount >= 0 ? row[columnIndex.amount] : "";
    const rawType = columnIndex.type >= 0 ? row[columnIndex.type] : "";
    const rawCategory = columnIndex.category >= 0 ? row[columnIndex.category] : "";
    const rawSubcategory = columnIndex.subcategory >= 0 ? row[columnIndex.subcategory] : "";
    const rawTags = columnIndex.tags >= 0 ? row[columnIndex.tags] : "";

    const date = normalizeDate(rawDate) ?? "";
    const amount = normalizeAmount(rawAmount) ?? "";
    let type = normalizeType(rawType) ?? "";

    let amountValue = amount;
    if (type === "" && amountValue) {
      type = Number(amountValue) < 0 ? "EXPENSE" : "";
    }
    if (amountValue.startsWith("-")) {
      amountValue = amountValue.slice(1);
    }

    const candidate = {
      date,
      description: rawDescription.trim(),
      amount: amountValue,
      type,
      category: rawCategory.trim(),
      subcategory: rawSubcategory.trim(),
      tags: rawTags.trim(),
    };

    const parsed = importRowSchema.safeParse(candidate);
    const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

    return { index, ...candidate, error };
  });
}

type ImportWizardProps = {
  existingCategories: ExistingCategoryRef[];
};

export function ImportWizard({ existingCategories }: ImportWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, string>>({
    date: NONE,
    description: NONE,
    amount: NONE,
    type: NONE,
    category: NONE,
    subcategory: NONE,
    tags: NONE,
  });
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [isMappingExpanded, setIsMappingExpanded] = useState(false);
  const [overrides, setOverrides] = useState<Record<number, Partial<Pick<MappedRow, EditableField>>>>({});
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [page, setPage] = useState(1);
  const [editingCell, setEditingCell] = useState<{ index: number; field: EditableField } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawMappedRows = useMemo(() => {
    if (!sheet) return [];
    return buildMappedRows(sheet, mapping);
  }, [sheet, mapping]);

  // Aplica overrides de edição inline por linha e revalida, depois remove as linhas excluídas pelo usuário.
  const mappedRows = useMemo(() => {
    return rawMappedRows
      .filter((row) => !removedIndexes.has(row.index))
      .map((row) => {
        const override = overrides[row.index];
        if (!override) return row;

        const candidate = { ...row, ...override };
        const parsed = importRowSchema.safeParse(candidate);
        const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

        return { ...candidate, error };
      });
  }, [rawMappedRows, overrides, removedIndexes]);

  const validRows = mappedRows.filter((row) => !row.error);
  const invalidRows = mappedRows.filter((row) => row.error);
  const isMappingComplete = REQUIRED_FIELDS.every((field) => mapping[field.key] !== NONE);

  const summary = useMemo(
    () => summarizeMappedRows(mappedRows, existingCategories),
    [mappedRows, existingCategories]
  );

  const filteredRows = useMemo(() => {
    if (rowFilter === "valid") return mappedRows.filter((row) => !row.error);
    if (rowFilter === "invalid") return mappedRows.filter((row) => row.error);
    return mappedRows;
  }, [mappedRows, rowFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredRows, currentPage]
  );

  function toggleFilter(filter: RowFilter) {
    setRowFilter((current) => (current === filter ? "all" : filter));
    setPage(1);
  }

  function handleRemoveRow(index: number) {
    setRemovedIndexes((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }

  function handleEditField(index: number, field: EditableField, value: string) {
    setOverrides((current) => ({
      ...current,
      [index]: { ...current[index], [field]: value },
    }));
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/parse", { method: "POST", body: formData });
      const json = await response.json();

      if (!response.ok || !json.success) {
        toast.error(json.message ?? "Não foi possível ler esse arquivo. Verifique se é um .xlsx ou .xls válido");
        return;
      }

      const parsed: ParsedSheet = json.data;

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("Não encontramos dados nessa planilha");
        return;
      }

      if (json.truncated) {
        toast.error(`A planilha tem mais de 1000 linhas. Apenas as primeiras 1000 serão importadas.`);
      }

      const guessedMapping: Record<ImportFieldKey, string> = {
        date: NONE,
        description: NONE,
        amount: NONE,
        type: NONE,
        category: NONE,
        subcategory: NONE,
        tags: NONE,
      };
      const guesses: Record<ImportFieldKey, string[]> = {
        date: ["data", "date", "dia"],
        description: ["transação", "transacao", "descrição", "descricao", "description", "histórico", "historico"],
        amount: ["valor", "amount", "preço", "preco", "total"],
        type: ["tipo", "type", "natureza"],
        category: ["categoria", "category", "grupo"],
        subcategory: ["sub-categoria", "subcategoria", "sub categoria", "subcategory", "sub-grupo", "subgrupo"],
        tags: ["tags", "hashtags", "etiquetas"],
      };
      for (const field of IMPORT_FIELDS) {
        const match = parsed.headers.find((header) => guesses[field.key].includes(header.trim().toLowerCase()));
        if (match) guessedMapping[field.key] = match;
      }

      const allFieldsGuessed = IMPORT_FIELDS.every((field) => guessedMapping[field.key] !== NONE);

      setSheet(parsed);
      setMapping(guessedMapping);
      setFileName(file.name);
      setIsMappingExpanded(!allFieldsGuessed);
      setOverrides({});
      setRemovedIndexes(new Set());
      setRowFilter("all");
      setEditingCell(null);
      setPage(1);
      setStep("map");
    } catch {
      toast.error("Não foi possível ler esse arquivo. Verifique se é um .xlsx ou .xls válido");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleConfirmImport() {
    if (validRows.length === 0) {
      toast.error("Nenhuma linha válida para importar");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await importTransactionsAction(
        validRows.map(({ date, description, amount, type, category, subcategory, tags }) => ({
          date,
          description,
          amount,
          type,
          category,
          subcategory,
          tags,
        }))
      );

      if (!response.success) {
        toast.error(response.message ?? "Não foi possível importar");
        return;
      }

      setResult({ imported: response.imported ?? 0, skipped: (response.skipped ?? 0) + invalidRows.length });
      setStep("result");
      toast.success(response.message ?? "Importação concluída");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setSheet(null);
    setFileName("");
    setMapping({ date: NONE, description: NONE, amount: NONE, type: NONE, category: NONE, subcategory: NONE, tags: NONE });
    setResult(null);
    setIsMappingExpanded(false);
    setOverrides({});
    setRemovedIndexes(new Set());
    setRowFilter("all");
    setPage(1);
    setEditingCell(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-(--color-text)">Arquivo modelo</h2>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">
            Baixe a planilha de exemplo com as colunas esperadas: Data, Tipo, Transação, Categoria, Sub-categoria, Valor e Tags
          </p>
        </div>
        <a href="/api/import/template" download>
          <Button type="button" variant="secondary">
            <Download size={16} aria-hidden="true" />
            Baixar modelo .xlsx
          </Button>
        </a>
      </Card>

      {step === "upload" && (
        <Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
            <FileSpreadsheet size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-(--color-text)">Envie sua planilha</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">Arquivos .xlsx ou .xls com seus lançamentos</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="import-file-input"
            onChange={handleFileChange}
          />
          <Button type="button" isLoading={isParsing} onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            Selecionar arquivo
          </Button>
        </Card>
      )}

      {step === "map" && sheet && (
        <>
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-base font-semibold text-(--color-text)">Mapeamento de colunas</h2>
                <p className="mt-0.5 truncate text-xs text-(--color-text-muted)">
                  {fileName} · {sheet.rows.length} linha(s) encontrada(s)
                  {!isMappingExpanded && isMappingComplete && " · detectado automaticamente"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isMappingComplete && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsMappingExpanded((current) => !current)}
                  >
                    {isMappingExpanded ? (
                      <>
                        <ChevronUp size={16} aria-hidden="true" />
                        Recolher
                      </>
                    ) : (
                      <>
                        <ChevronDown size={16} aria-hidden="true" />
                        Revisar colunas
                      </>
                    )}
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={handleReset}>
                  Trocar arquivo
                </Button>
              </div>
            </div>

            {(isMappingExpanded || !isMappingComplete) && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-(--color-text)" htmlFor={`map-${field.key}`}>
                      {field.label}
                      {!field.required && <span className="text-(--color-text-muted)"> (opcional)</span>}
                    </label>
                    <select
                      id={`map-${field.key}`}
                      className={selectClass()}
                      value={mapping[field.key]}
                      onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      <option value={NONE}>{field.required ? "Selecione a coluna…" : "Não importar"}</option>
                      {sheet.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {isMappingComplete && (
            <Card className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ClipboardList size={18} className="text-(--color-primary)" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-(--color-text)">Resumo da importação</h2>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                <SummaryStat label="Linhas" value={String(summary.totalRows)} />
                <SummaryStat
                  label="Válidas"
                  value={String(summary.validCount)}
                  tone="success"
                  active={rowFilter === "valid"}
                  onClick={() => toggleFilter("valid")}
                />
                <SummaryStat
                  label="Com erro"
                  value={String(summary.invalidCount)}
                  tone={summary.invalidCount > 0 ? "danger" : undefined}
                  active={rowFilter === "invalid"}
                  onClick={() => toggleFilter("invalid")}
                />
                <SummaryStat label="Entradas" value={formatCurrency(summary.totalIncome)} tone="success" />
                <SummaryStat label="Despesas" value={formatCurrency(summary.totalExpense)} tone="danger" />
                <SummaryStat
                  label="Saldo"
                  value={formatCurrency(summary.balance)}
                  tone={summary.balance >= 0 ? "success" : "danger"}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <SummaryStat label="Categorias novas" value={String(summary.newCategoriesCount)} />
                <SummaryStat label="Categorias existentes" value={String(summary.existingCategoriesCount)} />
                <SummaryStat label="Sub-categorias novas" value={String(summary.newSubcategoriesCount)} />
                <SummaryStat label="Tags" value={String(summary.tagsCount)} />
              </div>
            </Card>
          )}

          {isMappingComplete && (
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-(--color-text)">Pré-visualização</h2>
                  <p className="mt-0.5 text-xs text-(--color-text-muted)">
                    <span className="text-(--color-success)">{validRows.length} válida(s)</span>
                    {invalidRows.length > 0 && (
                      <>
                        {" · "}
                        <span className="text-(--color-danger)">{invalidRows.length} com erro</span>
                      </>
                    )}
                    {removedIndexes.size > 0 && ` · ${removedIndexes.size} removida(s)`}
                  </p>
                  {rowFilter !== "all" && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-(--color-text-muted)">
                      Filtro ativo: {rowFilter === "valid" ? "somente válidas" : "somente com erro"}
                      <button
                        type="button"
                        onClick={() => setRowFilter("all")}
                        className="text-(--color-primary) underline-offset-2 hover:underline cursor-pointer"
                      >
                        Limpar filtro
                      </button>
                    </p>
                  )}
                </div>
                <Button type="button" onClick={handleConfirmImport} isLoading={isSubmitting} disabled={validRows.length === 0}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Importar {validRows.length} lançamento(s)
                </Button>
              </div>

              {validRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-danger)/10 text-(--color-danger)">
                    <AlertTriangle size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-(--color-text)">Nenhuma linha válida encontrada</h3>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      Revise o mapeamento de colunas ou corrija a planilha antes de importar
                    </p>
                  </div>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--color-primary)/10 text-(--color-primary)">
                    <ClipboardList size={22} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-(--color-text)">Nenhuma linha encontrada para esse filtro</h3>
                    <p className="mt-1 text-sm text-(--color-text-muted)">
                      <button
                        type="button"
                        onClick={() => setRowFilter("all")}
                        className="text-(--color-primary) underline-offset-2 hover:underline cursor-pointer"
                      >
                        Limpar filtro
                      </button>{" "}
                      para ver todas as linhas
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-(--color-border)">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-(--color-border) bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
                          <th scope="col" className="px-3 py-2">Status</th>
                          <th scope="col" className="px-3 py-2">Data</th>
                          <th scope="col" className="px-3 py-2">Transação</th>
                          <th scope="col" className="px-3 py-2">Valor</th>
                          <th scope="col" className="px-3 py-2">Tipo</th>
                          <th scope="col" className="px-3 py-2">Categoria</th>
                          <th scope="col" className="px-3 py-2">Sub-categoria</th>
                          <th scope="col" className="px-3 py-2">Tags</th>
                          <th scope="col" className="px-3 py-2">
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => (
                          <tr key={row.index} className="border-b border-(--color-border) last:border-0">
                            <td className="px-3 py-2">
                              {row.error ? (
                                <span className="inline-flex items-center gap-1.5 text-xs text-(--color-danger)">
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  {row.error}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs text-(--color-success)">
                                  <CheckCircle2 size={14} aria-hidden="true" />
                                  OK
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-numeric text-(--color-text)">{row.date || "—"}</td>
                            <td className="px-3 py-2 text-(--color-text)">{row.description || "—"}</td>
                            <td className="px-3 py-2 font-numeric text-(--color-text)">
                              {row.amount ? formatCurrency(Number(row.amount)) : "—"}
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              {row.type === "EXPENSE" ? "Despesa" : row.type === "INCOME" ? "Entrada" : "—"}
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.category}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "category"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "category" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "category", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.subcategory}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "subcategory"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "subcategory" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "subcategory", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2 text-(--color-text)">
                              <EditableCell
                                value={row.tags}
                                isEditing={editingCell?.index === row.index && editingCell?.field === "tags"}
                                onStartEdit={() => setEditingCell({ index: row.index, field: "tags" })}
                                onConfirm={(value) => {
                                  handleEditField(row.index, "tags", value);
                                  setEditingCell(null);
                                }}
                                onCancel={() => setEditingCell(null)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(row.index)}
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
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft size={16} aria-hidden="true" />
                        Anterior
                      </Button>
                      <span className="text-xs text-(--color-text-muted)">
                        Página {currentPage} de {totalPages} · {filteredRows.length} linha(s)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}
        </>
      )}

      {step === "result" && result && (
        <Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-success)/10 text-(--color-success)">
            <CheckCircle2 size={28} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-(--color-text)">Importação concluída</h2>
            <p className="mt-1 text-sm text-(--color-text-muted)">
              {result.imported} lançamento(s) importado(s) com sucesso
              {result.skipped > 0 && ` · ${result.skipped} ignorado(s) por erro`}
            </p>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={handleReset}>
              Importar outro arquivo
            </Button>
            <Button type="button" onClick={() => router.push("/lancamentos")}>
              Ver lançamentos importados
            </Button>
          </div>
        </Card>
      )}

      {isParsing && step === "upload" && (
        <div className="flex items-center justify-center gap-2 text-sm text-(--color-text-muted)">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Lendo planilha…
        </div>
      )}
    </div>
  );
}
