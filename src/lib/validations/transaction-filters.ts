import { z } from "zod";

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const asArray = (value: unknown) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

export const transactionFiltersSchema = z.object({
  categoryId: z.preprocess(firstValue, z.string().trim().min(1).optional()),
  subcategoryId: z.preprocess(firstValue, z.string().trim().min(1).optional()),
  description: z.preprocess(firstValue, z.string().trim().max(200).min(1).optional()),
  amountOperator: z.preprocess(firstValue, z.enum(["eq", "gt", "lt"]).optional()),
  amountValue: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .min(1)
      .transform((value) => Number(value))
      .refine((value) => !Number.isNaN(value), { message: "Valor inválido" })
      .optional()
  ),
  month: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido")
      .optional()
  ),
  day: z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .min(1)
      .transform((value) => Number(value))
      .refine((value) => Number.isInteger(value) && value >= 1 && value <= 31, { message: "Dia inválido" })
      .optional()
  ),
  period: z.preprocess(firstValue, z.enum(["30", "45", "60", "all"]).optional()),
  type: z.preprocess(firstValue, z.enum(["EXPENSE", "INCOME"]).optional()),
  isFixed: z.preprocess(firstValue, z.enum(["true", "false"]).optional()),
  installment: z.preprocess(firstValue, z.enum(["true"]).optional()),
  tagIds: z.preprocess(asArray, z.array(z.string().trim().min(1)).optional()),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export function parseTransactionFilters(searchParams: Record<string, string | string[] | undefined>): TransactionFilters {
  const result = transactionFiltersSchema.safeParse(searchParams);
  if (!result.success) {
    return {};
  }
  return result.data;
}

/**
 * `Object.fromEntries(url.searchParams)` descarta valores repetidos da mesma chave (fica só o
 * último). Usado nos consumidores que recebem a query como string crua (route handler, server
 * action de "carregar mais") para preservar múltiplos `tagIds` do mesmo jeito que o Next.js já
 * faz nativamente no `searchParams` de Server Component.
 */
export function searchParamsToRecord(params: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of params.keys()) {
    if (key in result) continue;
    const values = params.getAll(key);
    result[key] = values.length > 1 ? values : values[0]!;
  }
  return result;
}
