import { z } from "zod";

const MAX_SANE_AMOUNT = 10_000_000;

const wishKindSchema = z.enum(["NEED", "WANT"]);
const wishPurchaseTimingSchema = z.enum(["THIS_MONTH", "NEXT_MONTH", "LATER"]);
const wishPaymentMethodSchema = z.enum(["CASH", "INSTALLMENTS"]);

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

const wishBatchItemSchema = z
  .object({
    name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(140, "Nome muito longo"),
    estimatedAmount: z
      .number()
      .positive("Informe um valor maior que zero")
      .max(MAX_SANE_AMOUNT, "Valor informado é muito alto"),
    link: z.string().trim().url("Link inválido").max(2000).optional().or(z.literal("")),
    purchaseTiming: wishPurchaseTimingSchema,
    paymentMethod: wishPaymentMethodSchema,
    installmentsCount: z.number().int().positive("Informe ao menos 1 parcela").max(360).optional(),
    kind: wishKindSchema,
  })
  .refine((data) => data.paymentMethod !== "INSTALLMENTS" || Boolean(data.installmentsCount), {
    message: "Informe em quantas parcelas",
    path: ["installmentsCount"],
  });

export const createWishBatchSchema = z.object({
  categoryId: z.string().trim().min(1, "Selecione um grupo"),
  subcategoryId: z.string().trim().min(1, "Selecione um sub-grupo"),
  items: z.array(wishBatchItemSchema).min(1, "Adicione ao menos um item").max(100, "Adicione no máximo 100 itens por vez"),
});

export type CreateWishBatchInput = z.infer<typeof createWishBatchSchema>;

export const createWishesBulkSchema = z.object({
  categoryId: z.string().trim().min(1, "Selecione um grupo"),
  subcategoryId: z.string().trim().min(1, "Selecione um sub-grupo"),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(2, "Informe um nome com pelo menos 2 caracteres").max(140, "Nome muito longo"),
        estimatedAmount: z
          .number()
          .positive("Informe um valor maior que zero")
          .max(MAX_SANE_AMOUNT, "Valor informado é muito alto"),
      })
    )
    .min(1, "Adicione ao menos um item")
    .max(200, "Adicione no máximo 200 itens por vez"),
});

export type CreateWishesBulkInput = z.infer<typeof createWishesBulkSchema>;

export const reorderWishesSchema = z.object({
  wishIds: z.array(z.string().trim().min(1)).min(1, "Informe ao menos um desejo").max(500, "Quantidade de itens inválida"),
});

export type ReorderWishesInput = z.infer<typeof reorderWishesSchema>;
