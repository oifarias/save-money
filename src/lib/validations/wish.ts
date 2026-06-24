import { z } from "zod";

const MAX_SANE_AMOUNT = 10_000_000;

export const createWishSchema = z.object({
  name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(140, "Nome muito longo"),
  estimatedAmount: z
    .number()
    .positive("Informe um valor maior que zero")
    .max(MAX_SANE_AMOUNT, "Valor informado é muito alto"),
  categoryId: z.string().trim().min(1, "Selecione um grupo"),
  subcategoryId: z.string().trim().min(1, "Selecione um sub-grupo"),
  notes: z.string().trim().max(500, "Observação muito longa").optional().or(z.literal("")),
  imageUrl: z.string().trim().url("URL de imagem inválida").max(2000).optional().or(z.literal("")),
});

export type CreateWishInput = z.infer<typeof createWishSchema>;

export const linkWishGoalSchema = z
  .object({
    wishId: z.string().trim().min(1, "Desejo inválido"),
    goalId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(140, "Nome muito longo").optional(),
    targetAmount: z
      .number()
      .positive("Informe um valor maior que zero")
      .max(MAX_SANE_AMOUNT, "Valor informado é muito alto")
      .optional(),
    deadline: z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data limite inválida")
      .optional()
      .or(z.literal("")),
  })
  .refine((data) => Boolean(data.goalId) || Boolean(data.targetAmount), {
    message: "Informe uma meta existente ou um valor para criar uma nova",
    path: ["goalId"],
  });

export type LinkWishGoalInput = z.infer<typeof linkWishGoalSchema>;

export const addWishContributionSchema = z.object({
  wishId: z.string().trim().min(1, "Desejo inválido"),
  amount: z
    .number()
    .positive("Informe um valor maior que zero")
    .max(MAX_SANE_AMOUNT, "Valor informado é muito alto"),
});

export type AddWishContributionInput = z.infer<typeof addWishContributionSchema>;

export const markWishPurchasedSchema = z
  .object({
    wishId: z.string().trim().min(1, "Desejo inválido"),
    createTransaction: z.boolean(),
    amount: z
      .number()
      .positive("Informe um valor maior que zero")
      .max(MAX_SANE_AMOUNT, "Valor informado é muito alto")
      .optional(),
    date: z
      .string()
      .trim()
      .min(1, "Informe a data da compra")
      .refine((value) => !Number.isNaN(new Date(value).getTime()), "Data inválida")
      .optional(),
  })
  .refine((data) => !data.createTransaction || Boolean(data.amount), {
    message: "Informe o valor da compra",
    path: ["amount"],
  })
  .refine((data) => !data.createTransaction || Boolean(data.date), {
    message: "Informe a data da compra",
    path: ["date"],
  });

export type MarkWishPurchasedInput = z.infer<typeof markWishPurchasedSchema>;

export const abandonWishSchema = z.object({
  wishId: z.string().trim().min(1, "Desejo inválido"),
  reason: z.string().trim().max(500, "Motivo muito longo").optional().or(z.literal("")),
});

export type AbandonWishInput = z.infer<typeof abandonWishSchema>;
