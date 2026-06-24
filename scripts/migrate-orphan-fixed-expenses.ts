/**
 * Migração retroativa de `Transaction`s órfãs: lançamentos com `isFixed = true` mas sem
 * `fixedExpenseTemplateId` (criados antes de existir o resolver de despesas fixas em
 * `src/lib/fixed-expense-resolver.ts`). Cria um `FixedExpenseTemplate` por agrupamento e
 * vincula as transações correspondentes.
 *
 * Agrupamento replica a MESMA heurística do resolver (ver `resolveFixedExpenseTemplate`):
 * mesma `userId` + mesma `categoryId` (null conta como igual) + mesma descrição normalizada
 * (trim + lowercase). `expectedAmount`/`dueDay` do template criado vêm da transação mais
 * ANTIGA do grupo, espelhando o que o resolver faz na criação (`input.amount`/`input.date`).
 *
 * NÃO EXECUTE ESTE SCRIPT EM PRODUÇÃO SEM BACKUP PRÉVIO DO BANCO.
 *
 * Uso (após backup):
 *   npx tsx scripts/migrate-orphan-fixed-expenses.ts --dry-run   # só imprime os agrupamentos
 *   npx tsx scripts/migrate-orphan-fixed-expenses.ts             # aplica as escritas
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type GroupKey = string;

type OrphanTx = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  date: Date;
  categoryId: string | null;
  subcategoryId: string | null;
};

type Group = {
  userId: string;
  categoryId: string | null;
  description: string; // descrição "canônica" (da transação mais antiga), não normalizada
  transactions: OrphanTx[];
};

function normalizeDescription(description: string): string {
  return description.trim().toLowerCase();
}

function buildGroupKey(userId: string, categoryId: string | null, normalizedDescription: string): GroupKey {
  return `${userId}::${categoryId ?? "null"}::${normalizedDescription}`;
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const orphans = await prisma.transaction.findMany({
    where: { isFixed: true, fixedExpenseTemplateId: null },
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

  console.log(`[migrate-orphan-fixed-expenses] ${orphans.length} transação(ões) órfã(s) encontrada(s).`);

  const groups = new Map<GroupKey, Group>();

  for (const t of orphans) {
    const normalized = normalizeDescription(t.description);
    const key = buildGroupKey(t.userId, t.categoryId, normalized);
    const group = groups.get(key);
    if (group) {
      group.transactions.push(t);
    } else {
      groups.set(key, {
        userId: t.userId,
        categoryId: t.categoryId,
        description: t.description,
        transactions: [t],
      });
    }
  }

  console.log(`[migrate-orphan-fixed-expenses] ${groups.size} agrupamento(s) (userId + categoryId + descrição normalizada) detectado(s).`);

  for (const group of groups.values()) {
    group.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    console.log(
      `  - userId=${group.userId} categoryId=${group.categoryId ?? "null"} "${group.description}" -> ` +
        `${group.transactions.length} transação(ões)`
    );
  }

  if (isDryRun) {
    console.log("[migrate-orphan-fixed-expenses] --dry-run: nenhuma escrita foi aplicada.");
    return;
  }

  let templatesCreated = 0;
  let transactionsLinked = 0;

  for (const group of groups.values()) {
    await prisma.$transaction(async (tx) => {
      const oldest = group.transactions[0];

      const template = await tx.fixedExpenseTemplate.create({
        data: {
          userId: group.userId,
          description: oldest.description,
          expectedAmount: oldest.amount,
          dueDay: oldest.date.getDate(),
          categoryId: oldest.categoryId,
          subcategoryId: oldest.subcategoryId,
          isActive: true,
        },
      });
      templatesCreated += 1;

      const ids = group.transactions.map((t) => t.id);
      const { count } = await tx.transaction.updateMany({
        where: { id: { in: ids } },
        data: { fixedExpenseTemplateId: template.id },
      });
      transactionsLinked += count;
    });
  }

  console.log(
    `[migrate-orphan-fixed-expenses] ${templatesCreated} template(s) criado(s), ${transactionsLinked} transação(ões) vinculada(s).`
  );
}

main()
  .catch((error) => {
    console.error("[migrate-orphan-fixed-expenses] erro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
