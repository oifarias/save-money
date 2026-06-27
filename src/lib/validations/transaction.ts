import { z } from "zod";

export const transactionSchema = z
  .object({
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
    /** Marca a despesa como parcelada — soma-se à quantidade de parcelas para gerar os lançamentos futuros automaticamente. */
    isInstallment: z.boolean().optional(),
    totalInstallments: z
      .string()
      .trim()
      .optional()
      .or(z.literal(""))
      .refine((value) => !value || (Number.isInteger(Number(value)) && Number(value) >= 2 && Number(value) <= 360), {
        message: "Informe um número de parcelas entre 2 e 360",
      }),
  })
  .superRefine((data, ctx) => {
    if (data.isInstallment && !data.totalInstallments) {
      ctx.addIssue({
        code: "custom",
        path: ["totalInstallments"],
        message: "Informe a quantidade de parcelas",
      });
    }
    if (data.isInstallment && data.type === "INCOME") {
      ctx.addIssue({
        code: "custom",
        path: ["isInstallment"],
        message: "Parcelamento não se aplica a entradas",
      });
    }
  });

export type TransactionInput = z.infer<typeof transactionSchema>;

export const batchCreateTransactionSchema = z.object({
  items: z
    .array(transactionSchema)
    .min(1, "Adicione ao menos um lançamento")
    .max(50, "Limite de 50 lançamentos por lote"),
});

export type BatchCreateTransactionInput = z.infer<typeof batchCreateTransactionSchema>;
