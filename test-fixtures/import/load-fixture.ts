import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSpreadsheetFile, type ParsedSheet } from "@/lib/import-helpers";
import { IMPORT_FIELDS, type ImportFieldKey } from "@/lib/validations/import";

const FIXTURES_DIR = path.join(__dirname);

export const FIXTURE_FILES = {
  validos: "importacao-cenarios-validos.xlsx",
  erro: "importacao-cenarios-erro.xlsx",
  mistos: "importacao-cenarios-mistos.xlsx",
} as const;

export type FixtureName = keyof typeof FIXTURE_FILES;

/** Lê um dos 3 arquivos .xlsx de fixture e devolve `{ headers, rows }` via `parseSpreadsheetFile`. */
export function readFixtureSheet(name: FixtureName): ParsedSheet {
  const filePath = path.join(FIXTURES_DIR, FIXTURE_FILES[name]);
  const buffer = readFileSync(filePath);
  // `parseSpreadsheetFile` espera um ArrayBuffer (mesmo formato recebido via fetch no browser/route handler).
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return parseSpreadsheetFile(arrayBuffer);
}

/**
 * Mapeamento 1:1 headers -> campos, igual ao que `guessColumnMapping` produziria para a
 * planilha-modelo do sistema (mesmos nomes de coluna usados em `/api/import/template`).
 */
export function identityMapping(): Record<ImportFieldKey, string> {
  const headerByField: Record<ImportFieldKey, string> = {
    date: "Data",
    description: "Transação",
    amount: "Valor",
    type: "Tipo",
    category: "Categoria",
    subcategory: "Sub-categoria",
    tags: "Tags",
    installments: "Parcelas (x/y)",
    isFixed: "Despesa fixa",
  };
  return Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, headerByField[field.key]])) as Record<
    ImportFieldKey,
    string
  >;
}
