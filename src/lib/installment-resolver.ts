import type { Prisma } from "@/generated/prisma/client";

/** Casa "(x/y)" no final da descrição, ex.: "Notebook (3/4)" -> x=3, y=4. */
const INSTALLMENT_PATTERN = /\((\d+)\/(\d+)\)\s*$/;

/** Janela de tolerância (em dias) entre a projeção do plano e a data informada da transação. */
const TOLERANCE_DAYS = 10;
const TOLERANCE_MS = TOLERANCE_DAYS * 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient;

export type ParsedInstallmentDescription = {
  baseDescription: string;
  installmentNumber: number;
  totalInstallments: number;
};

/**
 * Extrai "(x/y)" do final da descrição, validando que `y > 1` e `1 <= x <= y` para evitar
 * falsos positivos como "Conta (compartilhada)" ou "Salário (CLT)".
 */
export function parseInstallmentDescription(description: string): ParsedInstallmentDescription | null {
  const match = description.match(INSTALLMENT_PATTERN);
  if (!match) return null;

  const installmentNumber = Number(match[1]);
  const totalInstallments = Number(match[2]);

  if (!Number.isInteger(installmentNumber) || !Number.isInteger(totalInstallments)) return null;
  if (totalInstallments <= 1) return null;
  if (installmentNumber < 1 || installmentNumber > totalInstallments) return null;

  const baseDescription = description.slice(0, match.index).trim();
  if (!baseDescription) return null;

  return { baseDescription, installmentNumber, totalInstallments };
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

export type ResolveInstallmentPlanInput = {
  description: string;
  date: Date;
  amount: number;
  categoryId?: string | null;
  subcategoryId?: string | null;
  /** Id da própria transação sendo editada — ignorado ao verificar se o slot já está ocupado. */
  excludeTransactionId?: string;
};

export type ResolveInstallmentPlanResult = {
  installmentPlanId: string;
  installmentNumber: number;
};

/**
 * Detecta o padrão "(x/y)" na descrição e vincula a transação a um `InstallmentPlan` existente
 * (mesma `baseDescription` + `totalInstallments`, com projeção de data dentro da tolerância e
 * sem outra transação já ocupando aquele `installmentNumber`) ou cria um novo plano.
 * Retorna `null` se a descrição não bater o padrão de parcelamento.
 */
export async function resolveInstallmentPlan(
  tx: Db,
  userId: string,
  input: ResolveInstallmentPlanInput
): Promise<ResolveInstallmentPlanResult | null> {
  const parsed = parseInstallmentDescription(input.description);
  if (!parsed) return null;

  const { baseDescription, installmentNumber, totalInstallments } = parsed;

  const candidates = await tx.installmentPlan.findMany({
    where: { userId, baseDescription, totalInstallments },
    include: { transactions: { select: { id: true, installmentNumber: true } } },
  });

  for (const candidate of candidates) {
    const projectedDate = addMonths(candidate.startDate, installmentNumber - 1);
    const withinTolerance = Math.abs(projectedDate.getTime() - input.date.getTime()) <= TOLERANCE_MS;
    if (!withinTolerance) continue;

    const slotTaken = candidate.transactions.some(
      (t) => t.installmentNumber === installmentNumber && t.id !== input.excludeTransactionId
    );
    if (slotTaken) continue;

    return { installmentPlanId: candidate.id, installmentNumber };
  }

  const startDate = addMonths(input.date, -(installmentNumber - 1));

  const created = await tx.installmentPlan.create({
    data: {
      userId,
      baseDescription,
      totalInstallments,
      estimatedAmount: input.amount,
      startDate,
      categoryId: input.categoryId || null,
      subcategoryId: input.subcategoryId || null,
    },
  });

  return { installmentPlanId: created.id, installmentNumber };
}
