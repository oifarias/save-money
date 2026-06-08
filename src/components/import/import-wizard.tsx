"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { importRowSchema, IMPORT_FIELDS, type ImportFieldKey } from "@/lib/validations/import";
import {
  parseSpreadsheetFile,
  normalizeAmount,
  normalizeDate,
  normalizeType,
  type ParsedSheet,
} from "@/lib/import-helpers";
import { importTransactionsAction } from "@/app/(app)/importar/actions";

type SelectOption = { id: string; name: string };

type Step = "upload" | "map" | "result";

type MappedRow = {
  index: number;
  date: string;
  description: string;
  amount: string;
  type: string;
  error?: string;
};

const NONE = "__none__";

function selectClass() {
  return "rounded-xl border border-(--color-border) bg-(--color-surface) px-3.5 py-2.5 text-sm text-(--color-text) outline-none transition-colors focus:border-(--color-primary) focus:ring-2 focus:ring-(--color-primary)/20";
}

function buildMappedRows(sheet: ParsedSheet, mapping: Record<ImportFieldKey, string>): MappedRow[] {
  const columnIndex: Record<ImportFieldKey, number> = {
    date: mapping.date === NONE ? -1 : sheet.headers.indexOf(mapping.date),
    description: mapping.description === NONE ? -1 : sheet.headers.indexOf(mapping.description),
    amount: mapping.amount === NONE ? -1 : sheet.headers.indexOf(mapping.amount),
    type: mapping.type === NONE ? -1 : sheet.headers.indexOf(mapping.type),
  };

  return sheet.rows.map((row, index) => {
    const rawDate = columnIndex.date >= 0 ? row[columnIndex.date] : "";
    const rawDescription = columnIndex.description >= 0 ? row[columnIndex.description] : "";
    const rawAmount = columnIndex.amount >= 0 ? row[columnIndex.amount] : "";
    const rawType = columnIndex.type >= 0 ? row[columnIndex.type] : "";

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
    };

    const parsed = importRowSchema.safeParse(candidate);
    const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

    return { index, ...candidate, error };
  });
}

export function ImportWizard({
  accounts,
  categories,
}: {
  accounts: SelectOption[];
  categories: SelectOption[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<Record<ImportFieldKey, string>>({
    date: NONE,
    description: NONE,
    amount: NONE,
    type: NONE,
  });
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mappedRows = useMemo(() => {
    if (!sheet) return [];
    return buildMappedRows(sheet, mapping);
  }, [sheet, mapping]);

  const validRows = mappedRows.filter((row) => !row.error);
  const invalidRows = mappedRows.filter((row) => row.error);
  const isMappingComplete = IMPORT_FIELDS.every((field) => mapping[field.key] !== NONE);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSpreadsheetFile(buffer);

      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("Não encontramos dados nessa planilha");
        return;
      }

      const guessedMapping: Record<ImportFieldKey, string> = { date: NONE, description: NONE, amount: NONE, type: NONE };
      const guesses: Record<ImportFieldKey, string[]> = {
        date: ["data", "date", "dia"],
        description: ["descrição", "descricao", "description", "histórico", "historico"],
        amount: ["valor", "amount", "preço", "preco", "total"],
        type: ["tipo", "type", "natureza"],
      };
      for (const field of IMPORT_FIELDS) {
        const match = parsed.headers.find((header) => guesses[field.key].includes(header.trim().toLowerCase()));
        if (match) guessedMapping[field.key] = match;
      }

      setSheet(parsed);
      setMapping(guessedMapping);
      setFileName(file.name);
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
        accountId,
        categoryId,
        validRows.map(({ date, description, amount, type }) => ({ date, description, amount, type }))
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
    setMapping({ date: NONE, description: NONE, amount: NONE, type: NONE });
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-(--color-text)">Arquivo modelo</h2>
          <p className="mt-0.5 text-sm text-(--color-text-muted)">
            Baixe a planilha de exemplo com as colunas esperadas: data, descrição, valor e tipo
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
          <label htmlFor="import-file-input">
            <Button type="button" isLoading={isParsing} className="cursor-pointer">
              <Upload size={16} aria-hidden="true" />
              Selecionar arquivo
            </Button>
          </label>
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
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={handleReset}>
                Trocar arquivo
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {IMPORT_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-(--color-text)" htmlFor={`map-${field.key}`}>
                    {field.label}
                  </label>
                  <select
                    id={`map-${field.key}`}
                    className={selectClass()}
                    value={mapping[field.key]}
                    onChange={(event) => setMapping((current) => ({ ...current, [field.key]: event.target.value }))}
                  >
                    <option value={NONE}>Selecione a coluna…</option>
                    {sheet.headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-(--color-text)" htmlFor="import-account">
                  Conta de destino
                </label>
                <select
                  id="import-account"
                  className={selectClass()}
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-(--color-text)" htmlFor="import-category">
                  Grupo (aplicado a todos os lançamentos)
                </label>
                <select
                  id="import-category"
                  className={selectClass()}
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                >
                  <option value="">Sem grupo</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

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

              <div className="overflow-x-auto rounded-xl border border-(--color-border)">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-(--color-border) bg-(--color-bg) text-xs uppercase tracking-wide text-(--color-text-muted)">
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Data</th>
                      <th className="px-3 py-2">Descrição</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 50).map((row) => (
                      <tr key={row.index} className="border-b border-(--color-border) last:border-0">
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span
                              className="inline-flex items-center gap-1.5 text-xs text-(--color-danger)"
                              title={row.error}
                            >
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
                        <td className="px-3 py-2 font-numeric text-(--color-text)">{row.amount || "—"}</td>
                        <td className="px-3 py-2 text-(--color-text)">
                          {row.type === "EXPENSE" ? "Despesa" : row.type === "INCOME" ? "Entrada" : "—"}
                        </td>
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
