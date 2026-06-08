import { z } from "zod";

export const importRowSchema = z.object({
  date: z.string().trim().min(1, "Data ausente"),
  description: z.string().trim().min(1, "Descrição ausente").max(140, "Descrição muito longa"),
  amount: z
    .string()
    .trim()
    .min(1, "Valor ausente")
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) > 0, {
      message: "Valor inválido",
    }),
  type: z.enum(["EXPENSE", "INCOME"], { message: "Tipo inválido (use despesa ou entrada)" }),
});

export type ImportRowInput = z.infer<typeof importRowSchema>;

export const IMPORT_FIELDS = [
  { key: "date", label: "Data", required: true },
  { key: "description", label: "Descrição", required: true },
  { key: "amount", label: "Valor", required: true },
  { key: "type", label: "Tipo (despesa/entrada)", required: true },
] as const;

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]["key"];
