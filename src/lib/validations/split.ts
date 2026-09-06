import { z } from "zod";

const shareSchema = z.object({
  participantIndex: z.number().int().min(0),
  amount: z.number().positive("Informe um valor maior que zero"),
});

const itemSchema = z.object({
  transactionId: z.string().trim().min(1),
  note: z.string().trim().max(200, "Observação muito longa").optional().default(""),
  shares: z.array(shareSchema).optional().default([]),
});

export const createSplitSchema = z
  .object({
    title: z.string().trim().min(1, "Informe um título").max(80, "Título muito longo"),
    mode: z.enum(["equal", "custom"]),
    showCategories: z.boolean().optional().default(false),
    items: z.array(itemSchema).min(1, "Selecione ao menos um lançamento"),
    participants: z
      .array(
        z.object({
          name: z.string().trim().min(1, "Informe um nome").max(60, "Nome muito longo"),
          amount: z.number().min(0, "Informe um valor maior ou igual a zero"),
        })
      )
      .min(1, "Adicione ao menos uma pessoa"),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== "custom") return;

    data.items.forEach((item, index) => {
      if (item.shares.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "shares"],
          message: "Selecione ao menos uma pessoa para este lançamento",
        });
        return;
      }

      const seen = new Set<number>();
      for (const share of item.shares) {
        if (share.participantIndex >= data.participants.length) {
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "shares"],
            message: "Participante inválido",
          });
        }
        if (seen.has(share.participantIndex)) {
          ctx.addIssue({
            code: "custom",
            path: ["items", index, "shares"],
            message: "Participante duplicado no lançamento",
          });
        }
        seen.add(share.participantIndex);
      }
    });
  });

export type CreateSplitInput = z.infer<typeof createSplitSchema>;
