import type { Prisma, TransactionType } from "@/generated/prisma/client";

type Db = Prisma.TransactionClient;

export function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

export type CreateInstallmentPlanInput = {
  baseDescription: string;
  totalInstallments: number;
  amount: number;
  startDate: Date;
  type: TransactionType;
  accountId: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  /**
   * Primeira parcela a materializar como `Transaction` (default 1, ou seja, gera 1..N).
   * Usado quando o usuário informa que está na parcela X: só materializa X..N.
   */
  startInstallmentNumber?: number;
};

export type CreatedInstallmentTransaction = {
  id: string;
  installmentNumber: number;
};

/**
 * Cria o `InstallmentPlan` e materializa as `Transaction` das parcelas no intervalo
 * `[startInstallmentNumber, totalInstallments]` nos meses seguintes, todas vinculadas ao mesmo
 * plano e replicando categoria/subcategoria.
 */
export async function createInstallmentPlanWithTransactions(
  tx: Db,
  userId: string,
  input: CreateInstallmentPlanInput
): Promise<{ installmentPlanId: string; transactions: CreatedInstallmentTransaction[] }> {
  const categoryId = input.categoryId || null;
  const subcategoryId = input.subcategoryId || null;
  const startInstallmentNumber = input.startInstallmentNumber ?? 1;

  const plan = await tx.installmentPlan.create({
    data: {
      userId,
      baseDescription: input.baseDescription,
      totalInstallments: input.totalInstallments,
      estimatedAmount: input.amount,
      startDate: input.startDate,
      categoryId,
      subcategoryId,
    },
  });

  const transactions: CreatedInstallmentTransaction[] = [];
  for (
    let installmentNumber = startInstallmentNumber;
    installmentNumber <= input.totalInstallments;
    installmentNumber += 1
  ) {
    const created = await tx.transaction.create({
      data: {
        userId,
        accountId: input.accountId,
        categoryId,
        subcategoryId,
        type: input.type,
        amount: input.amount,
        date: addMonths(input.startDate, installmentNumber - 1),
        description: input.baseDescription,
        installmentPlanId: plan.id,
        installmentNumber,
      },
      select: { id: true },
    });
    transactions.push({ id: created.id, installmentNumber });
  }

  return { installmentPlanId: plan.id, transactions };
}

/** Exclui em cascata todas as transações de um plano de parcelamento, junto com o próprio plano. */
export async function deleteInstallmentPlanCascade(tx: Db, userId: string, installmentPlanId: string) {
  await tx.transaction.deleteMany({ where: { userId, installmentPlanId } });
  await tx.installmentPlan.delete({ where: { id: installmentPlanId } });
}

export type PropagateInstallmentEditInput = {
  baseDescription: string;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
};

/**
 * Propaga edição de valor, descrição base, categoria/subcategoria para as demais parcelas do plano.
 * `excludeTransactionId`: exclui a transação já editada pelo chamador. Quando omitido, cai no
 * comportamento legado de excluir `installmentNumber = 1` (compat. com testes existentes).
 */
export async function propagateInstallmentEdit(
  tx: Db,
  userId: string,
  installmentPlanId: string,
  changes: PropagateInstallmentEditInput,
  excludeTransactionId?: string
): Promise<string[]> {
  const plan = await tx.installmentPlan.findFirst({
    where: { id: installmentPlanId, userId },
    select: { totalInstallments: true },
  });
  if (!plan) return [];

  const categoryId = changes.categoryId || null;
  const subcategoryId = changes.subcategoryId || null;

  const siblings = await tx.transaction.findMany({
    where: {
      userId,
      installmentPlanId,
      ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : { installmentNumber: { gt: 1 } }),
    },
    select: { id: true, installmentNumber: true },
  });

  for (const sibling of siblings) {
    await tx.transaction.update({
      where: { id: sibling.id },
      data: {
        amount: changes.amount,
        categoryId,
        subcategoryId,
        description: changes.baseDescription,
      },
    });
  }

  await tx.installmentPlan.update({
    where: { id: installmentPlanId },
    data: { baseDescription: changes.baseDescription, estimatedAmount: changes.amount, categoryId, subcategoryId },
  });

  return siblings.map((s) => s.id);
}
