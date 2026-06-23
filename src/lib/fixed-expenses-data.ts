import { prisma } from "@/lib/prisma";

export type FixedExpenseChecklistItem = {
  templateId: string;
  description: string;
  expectedAmount: number;
  dueDay: number;
  categoryName: string | null;
  status: "paid" | "pending";
  transactionId: string | null;
  paidAmount: number | null;
  paidDate: string | null; // ISO
};

/** Mês atual no fuso do servidor, no formato "YYYY-MM". */
function currentReferenceMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Lista as despesas fixas ativas do usuário com o status de pagamento do mês de referência
 * (default: mês atual). Para cada template, verifica se já existe uma transação vinculada
 * com aquele `referenceMonth` — único caso em que `fixedExpenseTemplateId + referenceMonth`
 * identifica de forma confiável "já paga este mês" (graças ao `@@unique` do schema).
 */
export async function getFixedExpensesChecklist(
  userId: string,
  referenceMonth: string = currentReferenceMonth()
): Promise<FixedExpenseChecklistItem[]> {
  const templates = await prisma.fixedExpenseTemplate.findMany({
    where: { userId, isActive: true },
    include: { category: { select: { name: true } } },
    orderBy: { dueDay: "asc" },
  });

  if (templates.length === 0) return [];

  const templateIds = templates.map((t) => t.id);

  const paidTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      fixedExpenseTemplateId: { in: templateIds },
      referenceMonth,
    },
    select: { id: true, fixedExpenseTemplateId: true, amount: true, date: true },
  });

  const paidByTemplateId = new Map(paidTransactions.map((t) => [t.fixedExpenseTemplateId as string, t]));

  return templates.map((template) => {
    const paid = paidByTemplateId.get(template.id);
    return {
      templateId: template.id,
      description: template.description,
      expectedAmount: template.expectedAmount,
      dueDay: template.dueDay,
      categoryName: template.category?.name ?? null,
      status: paid ? "paid" : "pending",
      transactionId: paid?.id ?? null,
      paidAmount: paid?.amount ?? null,
      paidDate: paid?.date.toISOString() ?? null,
    };
  });
}
