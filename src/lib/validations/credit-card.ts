import { z } from "zod";

export const VALID_BANK_CODES = ["btg", "itau", "bradesco", "santander", "nubank", "neon", "inter", "c6"] as const;

export type BankCode = (typeof VALID_BANK_CODES)[number];

export const creditCardSchema = z.object({
  bankCode: z.enum(VALID_BANK_CODES, { error: "Selecione um banco" }),
  nickname: z.string().trim().max(40, "Apelido muito longo").optional().or(z.literal("")),
  limit: z.coerce.number({ error: "Informe um valor" }).positive("O limite deve ser maior que zero"),
  dueDay: z.coerce.number({ error: "Informe o dia" }).int().min(1, "Dia entre 1 e 28").max(28, "Dia entre 1 e 28"),
});

export type CreditCardInput = z.infer<typeof creditCardSchema>;
