import type { Category, Prisma, PrismaClient } from "@/generated/prisma/client";
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
  const normalized = name.trim().toUpperCase();
  if (!normalized) return null;

  const existing = await db.category.findFirst({
    where: { userId, name: normalized, parentId: null },
  });
  if (existing) return existing;

  return db.category.create({
    data: { userId, name: normalized },
  });
}

/** Busca uma sub-categoria do usuário sob o pai informado pelo nome ou cria uma nova. */
export async function findOrCreateSubcategory(db: Db, userId: string, parentId: string, name: string) {
  const normalized = name.trim().toUpperCase();
  if (!normalized) return null;

  const existing = await db.category.findFirst({
    where: { userId, name: normalized, parentId },
  });
  if (existing) return existing;

  return db.category.create({
    data: { userId, name: normalized, parentId },
  });
}

/**
 * Resolve em lote categorias raiz do usuário pelos nomes informados: busca as existentes
 * em 1 query e cria as faltantes em 1 query (`createManyAndReturn`), independente da
 * quantidade de linhas de origem. Nomes vazios/duplicados são ignorados/deduplicados.
 */
export async function batchResolveRootCategories(db: Db, userId: string, names: string[]): Promise<Map<string, Category>> {
  const uniqueNames = Array.from(new Set(names.map((name) => name.trim().toUpperCase()).filter(Boolean)));
  if (uniqueNames.length === 0) return new Map();

  const existing = await db.category.findMany({
    where: { userId, parentId: null, name: { in: uniqueNames } },
  });
  const existingNames = new Set(existing.map((category) => category.name));

  const toCreate = uniqueNames.filter((name) => !existingNames.has(name));
  const created =
    toCreate.length > 0
      ? await db.category.createManyAndReturn({
          data: toCreate.map((name) => ({ userId, name })),
          skipDuplicates: true,
        })
      : [];

  const map = new Map<string, Category>();
  for (const category of [...existing, ...created]) {
    map.set(category.name, category);
  }
  return map;
}

/** Monta a chave usada para identificar uma sub-categoria pelo par (categoria pai, nome). */
export function subcategoryKey(parentId: string, name: string): string {
  return `${parentId}:${name}`;
}

/**
 * Resolve em lote sub-categorias sob os pais informados: busca as existentes em 1 query
 * (filtrando por `parentId IN (...)` e `name IN (...)`) e cria as faltantes em 1 query.
 * A chave do Map retornado é `"parentId:nome"`, já que o mesmo nome pode existir sob pais distintos.
 */
export async function batchResolveSubcategories(
  db: Db,
  userId: string,
  items: { parentId: string; name: string }[]
): Promise<Map<string, Category>> {
  const uniqueItems = new Map<string, { parentId: string; name: string }>();
  for (const item of items) {
    const name = item.name.trim().toUpperCase();
    if (!name) continue;
    uniqueItems.set(subcategoryKey(item.parentId, name), { parentId: item.parentId, name });
  }
  if (uniqueItems.size === 0) return new Map();

  const parentIds = Array.from(new Set([...uniqueItems.values()].map((item) => item.parentId)));
  const names = Array.from(new Set([...uniqueItems.values()].map((item) => item.name)));

  const existing = await db.category.findMany({
    where: { userId, parentId: { in: parentIds }, name: { in: names } },
  });
  const existingByKey = new Map(existing.map((category) => [subcategoryKey(category.parentId!, category.name), category]));

  const toCreate = [...uniqueItems.entries()].filter(([key]) => !existingByKey.has(key));
  const created =
    toCreate.length > 0
      ? await db.category.createManyAndReturn({
          data: toCreate.map(([, item]) => ({ userId, parentId: item.parentId, name: item.name })),
          skipDuplicates: true,
        })
      : [];

  const map = new Map<string, Category>(existingByKey);
  for (const category of created) {
    map.set(subcategoryKey(category.parentId!, category.name), category);
  }
  return map;
}
