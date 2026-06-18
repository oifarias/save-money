"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validations/category";

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
  return { success: true, message: "Grupo atualizado com sucesso" };
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
