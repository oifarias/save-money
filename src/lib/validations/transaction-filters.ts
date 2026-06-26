import { z } from "zod";

const firstValue = (value: unknown) => (Array.isArray(value) ? value[0] : value);

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
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export function parseTransactionFilters(searchParams: Record<string, string | string[] | undefined>): TransactionFilters {
  const result = transactionFiltersSchema.safeParse(searchParams);
  if (!result.success) {
    return {};
  }
  return result.data;
}
