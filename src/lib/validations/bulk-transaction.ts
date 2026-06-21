import { z } from "zod";

export const bulkUpdateTransactionSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Selecione ao menos um lançamento").max(500, "Selecione no máximo 500 lançamentos"),
  categoryId: z.string().trim().nullable().optional(),
  subcategoryId: z.string().trim().nullable().optional(),
  amount: z.number().positive("Informe um valor maior que zero").optional(),
  description: z.string().trim().min(1, "Informe uma descrição").max(140, "Descrição muito longa").optional(),
  date: z.string().trim().min(1, "Informe a data").optional(),
});

export type BulkUpdateTransactionInput = z.infer<typeof bulkUpdateTransactionSchema>;
