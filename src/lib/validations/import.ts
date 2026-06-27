import { z } from "zod";

const MAX_TAGS_PER_ROW = 15;

/** Palavras reconhecidas como "verdadeiro" para a coluna de lançamento fixo (case-insensitive). */
export const FIXED_TRUE_WORDS = ["sim", "s", "true", "1", "x", "yes", "y"];

/** Regex de "x/y" para a coluna de parcelas, ex.: "3/12". */
const INSTALLMENTS_PATTERN = /^(\d+)\/(\d+)$/;

/** Valida o formato bruto "x/y" das parcelas (mesma regra usada pelo helper de normalização). */
function isValidInstallmentsFormat(value: string): boolean {
  const match = value.match(INSTALLMENTS_PATTERN);
  if (!match) return false;

  const current = Number(match[1]);
  const total = Number(match[2]);

  if (!Number.isInteger(current) || !Number.isInteger(total)) return false;
  if (total <= 1) return false;
  if (current < 1 || current > total) return false;

  return true;
}

export const importRowSchema = z
  .object({
    date: z.string().trim().min(1, "Data ausente"),
    description: z.string().trim().min(1, "Descrição ausente").max(140, "Descrição muito longa"),
    amount: z
      .string()
      .trim()
      .min(1, "Valor ausente")
      .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
        message: "Valor inválido",
      }),
    type: z.enum(["EXPENSE", "INCOME"], { message: "Tipo inválido (use despesa ou entrada)" }),
    category: z.string().trim().max(40, "Categoria muito longa").optional().or(z.literal("")),
    subcategory: z.string().trim().max(40, "Sub-categoria muito longa").optional().or(z.literal("")),
    tags: z
      .string()
      .trim()
      .max(500, "Tags muito longas")
      .optional()
      .or(z.literal(""))
      .refine(
        (value) => {
          if (!value) return true;
          const count = value.split(",").filter((tag) => tag.trim().length > 0).length;
          return count <= MAX_TAGS_PER_ROW;
        },
        { message: `Máximo de ${MAX_TAGS_PER_ROW} tags por lançamento` }
      ),
    installments: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || isValidInstallmentsFormat(value), {
        message: "Formato de parcelas inválido (use x/y, ex: 3/12)",
      }),
    isFixed: z.string().trim().optional().or(z.literal("")),
  })
  .refine((data) => !(data.subcategory && !data.category), {
    message: "Sub-categoria requer uma categoria",
    path: ["subcategory"],
  });

export type ImportRowInput = z.infer<typeof importRowSchema>;

export const importRowsSchema = z.array(importRowSchema).max(1000, "Limite máximo de 1000 linhas por importação");

export const IMPORT_FIELDS = [
  { key: "date", label: "Data", required: true },
  { key: "description", label: "Transação", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "type", label: "Tipo (despesa/entrada)", required: true },
  { key: "category", label: "Categoria", required: false },
  { key: "subcategory", label: "Sub-categoria", required: false },
  { key: "tags", label: "Tags", required: false },
  { key: "installments", label: "Parcelas (x/y)", required: false },
  { key: "isFixed", label: "Fixa", required: false },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
