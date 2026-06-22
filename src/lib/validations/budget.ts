import { z } from "zod";

export const incomeBaselineSchema = z.object({
  amount: z.number().positive("Informe um valor maior que zero"),
  source: z.enum(["average_3_months", "manual"]),
});

export const budgetAllocationItemSchema = z.object({
  categoryId: z.string().trim().min(1),
  bucket: z.enum(["necessidade", "desejo"]),
  limitAmount: z.number().min(0, "Informe um valor maior ou igual a zero"),
});

export const budgetAllocationSchema = z.object({
  items: z.array(budgetAllocationItemSchema).min(1, "Defina ao menos um grupo"),
});
