import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(40, "Nome muito longo"),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{6})$/, "Informe uma cor hexadecimal válida"),
  icon: z.string().trim().min(1, "Selecione um ícone"),
});

export type CategoryInput = z.infer<typeof categorySchema>;
