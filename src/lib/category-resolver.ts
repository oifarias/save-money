import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/** Valida que grupo/sub-grupo informados pertencem ao usuário e que o sub-grupo é filho do grupo. */
export async function resolveCategoryAndSubcategory(
  userId: string,
  categoryId: string,
  subcategoryId: string
): Promise<{ error: Record<string, string> | null }> {
  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId, parentId: null } });
    if (!category) {
      return { error: { categoryId: "Grupo inválido" } };
    }
  }

  if (subcategoryId) {
    if (!categoryId) {
      return { error: { subcategoryId: "Selecione um grupo antes do sub-grupo" } };
    }
    const subcategory = await prisma.category.findFirst({ where: { id: subcategoryId, userId, parentId: categoryId } });
    if (!subcategory) {
      return { error: { subcategoryId: "Sub-grupo inválido" } };
    }
  }

  return { error: null };
}

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
