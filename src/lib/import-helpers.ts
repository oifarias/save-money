import * as XLSX from "xlsx";
import { cleanTagName } from "@/lib/tags";
import { FIXED_TRUE_WORDS, IMPORT_FIELDS, importRowSchema, type ImportFieldKey } from "@/lib/validations/import";

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

export type NormalizedInstallments = { current: number; total: number };

/** Parse de "x/y" (ex.: "3/12") para a coluna de parcelas. Retorna `null` se vazio ou inválido. */
export function normalizeInstallments(raw: string): NormalizedInstallments | null {
  const value = raw.trim();
  if (!value) return null;

  const match = value.match(/^(\d+)\/(\d+)$/);
  if (!match) return null;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (!Number.isInteger(current) || !Number.isInteger(total)) return null;
  if (total <= 1) return null;
  if (current < 1 || current > total) return null;

  return { current, total };
}

/** Normaliza a coluna "Fixa" (sim/não, true/false, 1/0, x...) para boolean. Válido para despesas e entradas. */
export function normalizeFixedFlag(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return false;
  return FIXED_TRUE_WORDS.includes(value);
}

export type SummarizableRow = {
  amount: string;
  type: string;
  category: string;
  subcategory: string;
  tags: string;
  installments?: string;
  isFixed?: string;
  error?: string;
};

/** Categoria existente do usuário, usada apenas para distinguir "nova" de "já existe" no resumo. */
export type ExistingCategoryRef = {
  name: string;
  parentName: string | null;
};

export type ImportSummary = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  totalIncome: number;
  totalExpense: number;
  balance: number;
  newCategoriesCount: number;
  existingCategoriesCount: number;
  newSubcategoriesCount: number;
  existingSubcategoriesCount: number;
  tagsCount: number;
  /** Quantidade de parcelas futuras (além da própria linha) que serão geradas pela importação. */
  futureInstallmentsCount: number;
};

export const NONE_COLUMN = "__none__";

export type MappedRow = {
  index: number;
  date: string;
  description: string;
  amount: string;
  type: string;
  category: string;
  subcategory: string;
  tags: string;
  installments: string;
  isFixed: string;
  error?: string;
};

/**
 * Aplica o mapeamento de colunas (header da planilha -> campo do sistema) às linhas já
 * parseadas, normaliza cada valor (data, valor, tipo) e valida com `importRowSchema`,
 * devolvendo a lista de linhas já no formato usado pela prévia/import do wizard.
 * Lógica pura (sem DOM), extraída do `ImportWizard` para ser testável com Vitest puro.
 */
export function buildMappedRows(sheet: ParsedSheet, mapping: Record<ImportFieldKey, string>): MappedRow[] {
  const columnIndex = Object.fromEntries(
    IMPORT_FIELDS.map((field) => [
      field.key,
      mapping[field.key] === NONE_COLUMN ? -1 : sheet.headers.indexOf(mapping[field.key]),
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
    const rawInstallments = columnIndex.installments >= 0 ? row[columnIndex.installments] : "";
    const rawIsFixed = columnIndex.isFixed >= 0 ? row[columnIndex.isFixed] : "";

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
      installments: rawInstallments.trim(),
      isFixed: rawIsFixed.trim(),
    };

    const parsed = importRowSchema.safeParse(candidate);
    const error = parsed.success ? undefined : parsed.error.issues[0]?.message;

    return { index, ...candidate, error };
  });
}

const COLUMN_GUESSES: Record<ImportFieldKey, string[]> = {
  date: ["data", "date", "dia"],
  description: ["transação", "transacao", "descrição", "descricao", "description", "histórico", "historico"],
  amount: ["valor", "amount", "preço", "preco", "total"],
  type: ["tipo", "type", "natureza"],
  category: ["categoria", "category", "grupo"],
  subcategory: ["sub-categoria", "subcategoria", "sub categoria", "subcategory", "sub-grupo", "subgrupo"],
  tags: ["tags", "hashtags", "etiquetas"],
  installments: ["parcelas (x/y)", "parcelas", "parcela", "installments", "parcelamento"],
  isFixed: ["despesa fixa", "entrada fixa", "fixa", "fixed", "is fixed", "recorrente"],
};

/** Tenta adivinhar o mapeamento de colunas a partir dos headers da planilha (mesmos nomes do modelo). */
export function guessColumnMapping(headers: string[]): Record<ImportFieldKey, string> {
  const guessedMapping = Object.fromEntries(IMPORT_FIELDS.map((field) => [field.key, NONE_COLUMN])) as Record<
    ImportFieldKey,
    string
  >;

  for (const field of IMPORT_FIELDS) {
    const match = headers.find((header) => COLUMN_GUESSES[field.key].includes(header.trim().toLowerCase()));
    if (match) guessedMapping[field.key] = match;
  }

  return guessedMapping;
}

/** Agrega as linhas já mapeadas/validadas da prévia de importação em métricas de resumo. */
export function summarizeMappedRows(
  rows: SummarizableRow[],
  existingCategories: ExistingCategoryRef[] = []
): ImportSummary {
  const existingRootNames = new Set(
    existingCategories.filter((category) => !category.parentName).map((category) => category.name.trim().toLowerCase())
  );
  const existingSubNames = new Set(
    existingCategories
      .filter((category) => category.parentName)
      .map((category) => `${category.parentName!.trim().toLowerCase()}::${category.name.trim().toLowerCase()}`)
  );

  let totalIncome = 0;
  let totalExpense = 0;
  let validCount = 0;

  const categoryNames = new Set<string>();
  const subcategoryKeys = new Set<string>();
  const tagNames = new Set<string>();
  let futureInstallmentsCount = 0;

  for (const row of rows) {
    if (!row.error) {
      validCount += 1;
      const amount = Number(row.amount);
      if (!Number.isNaN(amount)) {
        if (row.type === "INCOME") totalIncome += amount;
        if (row.type === "EXPENSE") totalExpense += amount;
      }

      const installments = normalizeInstallments(row.installments ?? "");
      if (installments) {
        futureInstallmentsCount += installments.total - installments.current;
      }
    }

    const category = row.category.trim();
    const subcategory = row.subcategory.trim();

    if (category) categoryNames.add(category);
    if (subcategory && category) subcategoryKeys.add(`${category.toLowerCase()}::${subcategory.toLowerCase()}`);
    for (const tag of normalizeTags(row.tags)) tagNames.add(tag);
  }

  let newCategoriesCount = 0;
  let existingCategoriesCount = 0;
  for (const name of categoryNames) {
    if (existingRootNames.has(name.toLowerCase())) existingCategoriesCount += 1;
    else newCategoriesCount += 1;
  }

  let newSubcategoriesCount = 0;
  let existingSubcategoriesCount = 0;
  for (const key of subcategoryKeys) {
    if (existingSubNames.has(key)) existingSubcategoriesCount += 1;
    else newSubcategoriesCount += 1;
  }

  return {
    totalRows: rows.length,
    validCount,
    invalidCount: rows.length - validCount,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    newCategoriesCount,
    existingCategoriesCount,
    newSubcategoriesCount,
    existingSubcategoriesCount,
    tagsCount: tagNames.size,
    futureInstallmentsCount,
  };
}
