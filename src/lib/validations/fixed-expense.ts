import { z } from "zod";

const MAX_SANE_AMOUNT = 10_000_000;

export const payFixedExpensesSchema = z
  .array(
    z.object({
      templateId: z.string().trim().min(1, "Despesa fixa inválida"),
      paidAmount: z
        .number()
        .positive("Informe um valor maior que zero")
        .max(MAX_SANE_AMOUNT, "Valor informado é muito alto"),
      paidDate: z
        .string()
        .trim()
        .min(1, "Informe a data do pagamento")
        .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data de pagamento inválida"),
    })
  )
  .min(1, "Selecione ao menos uma despesa fixa");

export type PayFixedExpensesInput = z.infer<typeof payFixedExpensesSchema>;
