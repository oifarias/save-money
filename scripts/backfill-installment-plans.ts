/**
 * Backfill de `InstallmentPlan` para `Transaction`s antigas cuja descrição já bate o padrão
 * "(x/y)" mas que foram criadas antes do resolver automático existir (sem `installmentPlanId`).
 *
 * Idempotente: ignora transações que já têm `installmentPlanId` preenchido.
 *
 * Uso:
 *   npx tsx scripts/backfill-installment-plans.ts --dry-run   # só imprime os agrupamentos detectados
 *   npx tsx scripts/backfill-installment-plans.ts             # aplica as escritas
 *
 * Não é uma migration do Prisma — é um script standalone, executado manualmente uma única vez.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseInstallmentDescription } from "../src/lib/installment-resolver";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type GroupKey = string;

type Group = {
  userId: string;
  baseDescription: string;
  totalInstallments: number;
  transactions: {
    id: string;
    description: string;
    amount: number;
    date: Date;
    categoryId: string | null;
    subcategoryId: string | null;
    installmentNumber: number;
  }[];
};

function buildGroupKey(userId: string, baseDescription: string, totalInstallments: number): GroupKey {
  return `${userId}::${baseDescription}::${totalInstallments}`;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, date.getDate());
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const transactions = await prisma.transaction.findMany({
    where: { installmentPlanId: null },
    select: {
      id: true,
      userId: true,
      description: true,
      amount: true,
      date: true,
      categoryId: true,
      subcategoryId: true,
    },
  });

  const groups = new Map<GroupKey, Group>();

  for (const t of transactions) {
    const parsed = parseInstallmentDescription(t.description);
    if (!parsed) continue;

    const key = buildGroupKey(t.userId, parsed.baseDescription, parsed.totalInstallments);
    const group = groups.get(key) ?? {
      userId: t.userId,
      baseDescription: parsed.baseDescription,
      totalInstallments: parsed.totalInstallments,
      transactions: [],
    };
    group.transactions.push({
      id: t.id,
      description: t.description,
      amount: t.amount,
      date: t.date,
      categoryId: t.categoryId,
      subcategoryId: t.subcategoryId,
      installmentNumber: parsed.installmentNumber,
    });
    groups.set(key, group);
  }

  console.log(`[backfill] ${transactions.length} transação(ões) sem plano analisadas.`);
  console.log(`[backfill] ${groups.size} agrupamento(s) (userId + baseDescription + totalInstallments) detectado(s).`);

  for (const group of groups.values()) {
    group.transactions.sort((a, b) => a.installmentNumber - b.installmentNumber);
    console.log(
      `  - userId=${group.userId} "${group.baseDescription}" (${group.totalInstallments}x) -> ` +
        `${group.transactions.length} parcela(s): [${group.transactions.map((t) => t.installmentNumber).join(", ")}]`
    );
  }

  if (isDryRun) {
    console.log("[backfill] --dry-run: nenhuma escrita foi aplicada.");
    return;
  }

  let plansCreated = 0;
  let transactionsLinked = 0;

  for (const group of groups.values()) {
    await prisma.$transaction(async (tx) => {
      const first = group.transactions[0];
      const startDate = addMonths(first.date, -(first.installmentNumber - 1));

      const plan = await tx.installmentPlan.create({
        data: {
          userId: group.userId,
          baseDescription: group.baseDescription,
          totalInstallments: group.totalInstallments,
          estimatedAmount: first.amount,
          startDate,
          categoryId: first.categoryId,
          subcategoryId: first.subcategoryId,
        },
      });
      plansCreated += 1;

      for (const t of group.transactions) {
        await tx.transaction.update({
          where: { id: t.id },
          data: { installmentPlanId: plan.id, installmentNumber: t.installmentNumber },
        });
        transactionsLinked += 1;
      }
    });
  }

  console.log(`[backfill] ${plansCreated} plano(s) criado(s), ${transactionsLinked} transação(ões) vinculada(s).`);
}

main()
  .catch((error) => {
    console.error("[backfill] erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
