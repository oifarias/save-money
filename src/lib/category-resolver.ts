import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/** Busca uma categoria raiz do usuário pelo nome ou cria uma nova com cor/ícone padrão. */
export async function findOrCreateRootCategory(db: Db, userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await db.category.findFirst({
    where: { userId, name: trimmed, parentId: null },
  });
  if (existing) return existing;

  return db.category.create({
    data: { userId, name: trimmed },
  });
}

/** Busca uma sub-categoria do usuário sob o pai informado pelo nome ou cria uma nova. */
export async function findOrCreateSubcategory(db: Db, userId: string, parentId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await db.category.findFirst({
    where: { userId, name: trimmed, parentId },
  });
  if (existing) return existing;

  return db.category.create({
    data: { userId, name: trimmed, parentId },
  });
}
