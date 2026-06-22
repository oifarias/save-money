import { z } from "zod";

export const createSplitSchema = z.object({
  title: z.string().trim().min(1, "Informe um título").max(80, "Título muito longo"),
  mode: z.enum(["equal", "custom"]),
  transactionIds: z.array(z.string().trim().min(1)).min(1, "Selecione ao menos um lançamento"),
  participants: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Informe um nome").max(60, "Nome muito longo"),
        amount: z.number().min(0, "Informe um valor maior ou igual a zero"),
      })
    )
    .min(1, "Adicione ao menos uma pessoa"),
});

export type CreateSplitInput = z.infer<typeof createSplitSchema>;
