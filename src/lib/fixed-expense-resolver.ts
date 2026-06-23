import type { Prisma } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;

export type ResolveFixedExpenseTemplateInput = {
  isFixed: boolean;
  description: string;
  date: Date;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  /** id da própria transação sendo editada — usado para não contar ela mesma ao decidir se desativa o template */
  excludeTransactionId?: string;
  /** template que a transação já tinha ANTES desta edição (null se nunca teve, ou é criação) */
  previousTemplateId?: string | null;
};

export type ResolveFixedExpenseTemplateResult = {
  fixedExpenseTemplateId: string | null;
};

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

/**
 * Resolve a vinculação de uma transação a um `FixedExpenseTemplate`.
 *
 * Regras são intencionalmente conservadoras para evitar duplicação/contaminação cross-mês:
 * editar a descrição/categoria de UMA transação isolada não deve alterar a expectativa
 * (expectedAmount/dueDay/categoria) de TODOS os meses daquela despesa fixa.
 */
export async function resolveFixedExpenseTemplate(
  tx: Db,
  userId: string,
  input: ResolveFixedExpenseTemplateInput
): Promise<ResolveFixedExpenseTemplateResult> {
  const { isFixed, previousTemplateId = null, excludeTransactionId } = input;

  if (!isFixed) {
    // A transação está deixando de ser fixa (ou nunca foi). Se ela estava vinculada a um
    // template, o caller já gravou `fixedExpenseTemplateId: null` na própria transação —
    // aqui só decidimos se o template ficou "órfão" (sem nenhuma outra transação vinculada)
    // e, se sim, o desativamos para não aparecer mais na checklist. Histórico é preservado:
    // nunca apagamos o template, só marcamos `isActive: false`.
    if (previousTemplateId) {
      const remaining = await tx.transaction.count({
        where: {
          fixedExpenseTemplateId: previousTemplateId,
          id: { not: excludeTransactionId ?? undefined },
        },
      });

      if (remaining === 0) {
        await tx.fixedExpenseTemplate.updateMany({
          where: { id: previousTemplateId, userId },
          data: { isActive: false },
        });
      }
    }

    return { fixedExpenseTemplateId: null };
  }

  // A transação é (ou continua sendo) fixa.
  if (previousTemplateId) {
    // Já estava vinculada a um template antes desta edição: não refazemos a busca por
    // descrição/categoria, nem reescrevemos os dados do template (expectedAmount/dueDay/
    // categoria) — isso evita que a edição de UMA transação propague para os demais meses
    // daquela despesa fixa. Só confirmamos que o template ainda existe e é do usuário atual.
    const template = await tx.fixedExpenseTemplate.findFirst({
      where: { id: previousTemplateId, userId },
      select: { id: true },
    });

    if (template) {
      return { fixedExpenseTemplateId: template.id };
    }
    // Template não existe mais (caso raro) — cai no fluxo de "criação nova" abaixo.
  }

  // Transação se tornando fixa agora (criação nova, ou checkbox marcado pela primeira vez
  // numa edição). Procuramos um template ATIVO do usuário com a mesma descrição normalizada
  // (trim + lowercase) e mesma categoria (ambos null contam como "mesma categoria"). Se achar
  // exatamente um, vinculamos SEM sobrescrever seus dados — é só mais uma transação naquela
  // série (ex.: lançamento do mês seguinte feito manualmente).
  const normalizedDescription = normalizeDescription(input.description);
  const categoryId = input.categoryId || null;

  const candidates = await tx.fixedExpenseTemplate.findMany({
    where: { userId, isActive: true, categoryId },
    select: { id: true, description: true },
  });

  const match = candidates.find((candidate) => normalizeDescription(candidate.description) === normalizedDescription);

  if (match) {
    return { fixedExpenseTemplateId: match.id };
  }

  const created = await tx.fixedExpenseTemplate.create({
    data: {
      userId,
      description: input.description,
      expectedAmount: input.amount,
      dueDay: input.date.getDate(),
      categoryId,
      subcategoryId: input.subcategoryId || null,
      isActive: true,
    },
  });

  return { fixedExpenseTemplateId: created.id };
}

/**
 * Calcula a data de vencimento de uma despesa fixa para um mês/ano específicos, ajustando
 * `dueDay` para o último dia do mês quando ele excede a quantidade de dias daquele mês
 * (ex.: dueDay 31 em fevereiro -> 28 ou 29, conforme ano bissexto).
 */
export function clampDueDateToMonth(year: number, monthIndex0: number, dueDay: number): Date {
  const lastDayOfMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const day = Math.min(dueDay, lastDayOfMonth);
  return new Date(year, monthIndex0, day);
}
