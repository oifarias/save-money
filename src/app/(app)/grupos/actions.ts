"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations/category";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  return session.user.id;
}

/** Invalida o cache (`unstable_cache`) das telas agregadas — nomes/cores de Category aparecem lá. */
function invalidateAggregateCaches(userId: string) {
  revalidateTag(dashboardCacheTag(userId), { expire: 0 });
  revalidateTag(comparativeCacheTag(userId), { expire: 0 });
  revalidateTag(insightsCacheTag(userId), { expire: 0 });
}

export async function createCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = categorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? ""),
    icon: String(formData.get("icon") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { parentId, ...data } = parsed.data;
  data.name = data.name.trim().toUpperCase();

  if (parentId) {
    const parent = await prisma.category.findFirst({ where: { id: parentId, userId, parentId: null } });
    if (!parent) {
      return { success: false, fieldErrors: { parentId: "Categoria pai inválida" } };
    }
  }

  const existing = await prisma.category.findFirst({
    where: { userId, name: data.name, parentId: parentId || null },
  });
  if (existing) {
    return { success: false, fieldErrors: { name: "Você já possui um grupo com esse nome" } };
  }

  await prisma.category.create({
    data: { userId, parentId: parentId || null, ...data },
  });

  revalidatePath("/grupos");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: "Grupo criado com sucesso" };
}

export async function updateCategoryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const parsed = categorySchema.safeParse({
    name: String(formData.get("name") ?? ""),
    color: String(formData.get("color") ?? ""),
    icon: String(formData.get("icon") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { parentId, ...data } = parsed.data;
  data.name = data.name.trim().toUpperCase();

  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    return { success: false, message: "Grupo não encontrado" };
  }

  if (parentId) {
    if (parentId === id) {
      return { success: false, fieldErrors: { parentId: "Uma categoria não pode ser pai de si mesma" } };
    }
    const parent = await prisma.category.findFirst({ where: { id: parentId, userId, parentId: null } });
    if (!parent) {
      return { success: false, fieldErrors: { parentId: "Categoria pai inválida" } };
    }
  }

  const duplicate = await prisma.category.findFirst({
    where: { userId, name: data.name, parentId: parentId || null, NOT: { id } },
  });
  if (duplicate) {
    return { success: false, fieldErrors: { name: "Você já possui um grupo com esse nome" } };
  }

  await prisma.category.update({
    where: { id },
    data: { ...data, parentId: parentId || null },
  });

  revalidatePath("/grupos");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: "Grupo atualizado com sucesso" };
}

export type BatchUpdateItem = { id: string; name: string; color: string; icon: string };

export async function batchUpdateCategoriesAction(items: BatchUpdateItem[]): Promise<ActionResult> {
  const userId = await requireUserId();

  if (items.length === 0) return { success: false, message: "Nenhum grupo selecionado" };

  const ids = items.map((item) => item.id);
  const existing = await prisma.category.findMany({ where: { id: { in: ids }, userId }, select: { id: true } });
  const validIds = new Set(existing.map((c) => c.id));

  const updates = items
    .filter((item) => validIds.has(item.id))
    .map((item) => {
      const parsed = categorySchema.safeParse({ name: item.name, color: item.color, icon: item.icon, parentId: "" });
      if (!parsed.success) return null;
      const { parentId: _parentId, ...data } = parsed.data;
      data.name = data.name.trim().toUpperCase();
      return { id: item.id, data };
    })
    .filter((u): u is { id: string; data: { name: string; color: string; icon: string } } => u !== null);

  if (updates.length === 0) return { success: false, message: "Nenhum dado válido para salvar" };

  await prisma.$transaction(updates.map((u) => prisma.category.update({ where: { id: u.id }, data: u.data })));

  revalidatePath("/grupos");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: `${updates.length} grupo${updates.length > 1 ? "s" : ""} atualizado${updates.length > 1 ? "s" : ""} com sucesso` };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const category = await prisma.category.findFirst({
    where: { id, userId },
    include: { _count: { select: { transactions: true, subTransactions: true, children: true } } },
  });

  if (!category) {
    return { success: false, message: "Grupo não encontrado" };
  }

  if (category._count.transactions > 0 || category._count.subTransactions > 0) {
    return {
      success: false,
      message: "Só é possível excluir grupos sem lançamentos vinculados",
    };
  }

  if (category._count.children > 0) {
    return {
      success: false,
      message: "Só é possível excluir grupos sem sub-grupos vinculados",
    };
  }

  await prisma.category.delete({ where: { id } });

  revalidatePath("/grupos");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: "Grupo excluído com sucesso" };
}

function flattenZodErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
