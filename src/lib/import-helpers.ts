import * as XLSX from "xlsx";
import { cleanTagName } from "@/lib/tags";

export type ParsedSheet = {
  headers: string[];
  rows: string[][];
};

/** Lê a primeira planilha de um arquivo .xlsx/.xls e devolve cabeçalho + linhas como texto. */
export function parseSpreadsheetFile(buffer: ArrayBuffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  if (matrix.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headerRow, ...dataRows] = matrix;
  const headers = headerRow.map((cell) => String(cell ?? "").trim());
  const rows = dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0))
    .map((row) => headers.map((_, index) => String(row[index] ?? "").trim()));

  return { headers, rows };
}

const EXPENSE_WORDS = ["despesa", "saida", "saída", "expense", "debito", "débito", "gasto", "d", "-"];
const INCOME_WORDS = ["entrada", "receita", "income", "credito", "crédito", "ganho", "e", "+"];

/** Normaliza valores de tipo vindos da planilha (PT/EN/abreviações) para o enum do sistema. */
export function normalizeType(raw: string): "EXPENSE" | "INCOME" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (EXPENSE_WORDS.includes(value)) return "EXPENSE";
  if (INCOME_WORDS.includes(value)) return "INCOME";
  return null;
}

/** Normaliza valores monetários em formato BR (1.234,56) ou US (1234.56) para string numérica com ponto. */
export function normalizeAmount(raw: string): string | null {
  let value = raw.trim().replace(/[^\d,.\-]/g, "");
  if (!value) return null;

  const isNegative = value.startsWith("-");
  value = value.replace(/^-/, "");

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma > lastDot) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    value = value.replace(/,/g, "");
  }

  const number = Number(value);
  if (Number.isNaN(number)) return null;

  return String(isNegative ? -number : number);
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Normaliza datas vindas como número de série do Excel, ISO ou formato BR (dd/mm/aaaa) para "yyyy-MM-dd". */
export function normalizeDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const brMatch = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (brMatch) {
    const [, day, month, yearRaw] = brMatch;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const iso = `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
  }

  if (/^\d+(\.\d+)?$/.test(value)) {
    const serial = Number(value);
    const date = new Date(EXCEL_EPOCH + serial * 86400000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Normaliza uma string de tags separadas por vírgula em uma lista limpa, sem vazios ou duplicadas. */
export function normalizeTags(raw: string): string[] {
  const names = raw
    .split(",")
    .map((value) => cleanTagName(value))
    .filter((value) => value.length > 0);
  return Array.from(new Set(names));
}
