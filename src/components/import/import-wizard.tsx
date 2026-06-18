"use client";

import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { importTransactionsAction } from "@/app/(app)/importar/actions";

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

function selectClass() {
  return "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20";
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-(--color-success)" : tone === "danger" ? "text-(--color-danger)" : "text-(--color-text)";

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-(--color-border) bg-(--color-bg) px-3.5 py-3">
      <span className="text-xs text-(--color-text-muted)">{label}</span>
      <span className={`font-numeric text-base font-semibold ${toneClass}`}>{value}</span>
    </div>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mappedRows = useMemo(() => {
    if (!sheet) return [];
    return buildMappedRows(sheet, mapping);
  }, [sheet, mapping]);

  const validRows = mappedRows.filter((row) => !row.error);
  const invalidRows = mappedRows.filter((row) => row.error);
  const isMappingComplete = REQUIRED_FIELDS.every((field) => mapping[field.key] !== NONE);

  const summary = useMemo(
    () => summarizeMappedRows(mappedRows, existingCategories),
    [mappedRows, existingCategories]
  );

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-(--color-text)">Mapeamento de colunas</h2>
                <p className="mt-0.5 text-xs text-(--color-text-muted)">
                  {fileName} · {sheet.rows.length} linha(s) encontrada(s)
                  {!isMappingExpanded && isMappingComplete && " · detectado automaticamente"}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                <SummaryStat label="Válidas" value={String(summary.validCount)} tone="success" />
                <SummaryStat label="Com erro" value={String(summary.invalidCount)} tone={summary.invalidCount > 0 ? "danger" : undefined} />
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
                  </p>
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
                        </tr>
                      </thead>
                      <tbody>
                        {mappedRows.slice(0, 50).map((row) => (
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
                            <td className="px-3 py-2 text-(--color-text)">{row.category || "—"}</td>
                            <td className="px-3 py-2 text-(--color-text)">{row.subcategory || "—"}</td>
                            <td className="px-3 py-2 text-(--color-text)">{row.tags || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {mappedRows.length > 50 && (
                    <p className="text-center text-xs text-(--color-text-muted)">
                      Mostrando 50 de {mappedRows.length} linhas. Todas serão processadas ao importar.
                    </p>
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
            <a href="/lancamentos">
              <Button type="button">Ver lançamentos</Button>
            </a>
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
