import type { Prisma, PrismaClient, Tag } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function cleanTagName(raw: string): string {
  return raw.trim().replace(/^#/, "").trim().toUpperCase();
}

/** Substitui as tags de um lançamento, criando as que ainda não existem para o usuário. */
export async function syncTransactionTags(db: Db, userId: string, transactionId: string, tagNames: string[]) {
  await db.transactionTag.deleteMany({ where: { transactionId, transaction: { userId } } });

  for (const rawName of tagNames) {
    const name = cleanTagName(rawName);
    if (!name) continue;

    const tag = await db.tag.upsert({
      where: { userId_name: { userId, name } },
      update: {},
      create: { userId, name },
    });

    await db.transactionTag.create({
      data: { transactionId, tagId: tag.id },
    });
  }
}

/**
 * Resolve em lote as tags do usuário pelos nomes informados: cria as faltantes em 1 query
 * (`createMany` com `skipDuplicates`, que mapeia para `ON CONFLICT DO NOTHING`) e busca os
 * ids de todas (novas + existentes) em 1 query. Nomes são limpos com `cleanTagName` e deduplicados.
 */
export async function batchResolveTags(db: Db, userId: string, names: string[]): Promise<Map<string, Tag>> {
  const uniqueNames = Array.from(new Set(names.map((name) => cleanTagName(name)).filter(Boolean)));
  if (uniqueNames.length === 0) return new Map();

  await db.tag.createMany({
    data: uniqueNames.map((name) => ({ userId, name })),
    skipDuplicates: true,
  });

  const tags = await db.tag.findMany({ where: { userId, name: { in: uniqueNames } } });
  return new Map(tags.map((tag) => [tag.name, tag]));
}
