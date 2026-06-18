import { z } from "zod";

export const transactionSchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  date: z.string().trim().min(1, "Informe a data"),
  description: z.string().trim().min(1, "Informe uma descrição").max(140, "Descrição muito longa"),
  amount: z
    .string()
    .trim()
    .min(1, "Informe o valor")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      message: "Informe um valor maior que zero",
    }),
  categoryId: z.string().trim().optional().or(z.literal("")),
  subcategoryId: z.string().trim().optional().or(z.literal("")),
  isFixed: z.boolean().optional(),
  recurrence: z.enum(["NONE", "WEEKLY", "MONTHLY"]),
  tags: z.array(z.string().trim().min(1).max(30)).max(10, "No máximo 10 hashtags"),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
