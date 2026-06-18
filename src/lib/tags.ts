import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function cleanTagName(raw: string): string {
  return raw.trim().replace(/^#/, "");
}

/** Substitui as tags de um lançamento, criando as que ainda não existem para o usuário. */
export async function syncTransactionTags(db: Db, userId: string, transactionId: string, tagNames: string[]) {
  await db.transactionTag.deleteMany({ where: { transactionId } });

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
