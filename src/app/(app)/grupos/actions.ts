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
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const existing = await prisma.category.findUnique({
    where: { userId_name: { userId, name: parsed.data.name } },
  });
  if (existing) {
    return { success: false, fieldErrors: { name: "Você já possui um grupo com esse nome" } };
  }

  await prisma.category.create({
    data: { userId, ...parsed.data },
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
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const category = await prisma.category.findFirst({ where: { id, userId } });
  if (!category) {
    return { success: false, message: "Grupo não encontrado" };
  }

  const duplicate = await prisma.category.findFirst({
    where: { userId, name: parsed.data.name, NOT: { id } },
  });
  if (duplicate) {
    return { success: false, fieldErrors: { name: "Você já possui um grupo com esse nome" } };
  }

  await prisma.category.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/grupos");
  revalidatePath("/lancamentos");
  return { success: true, message: "Grupo atualizado com sucesso" };
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const category = await prisma.category.findFirst({
    where: { id, userId },
    include: { _count: { select: { transactions: true } } },
  });

  if (!category) {
    return { success: false, message: "Grupo não encontrado" };
  }

  if (category._count.transactions > 0) {
    return {
      success: false,
      message: "Só é possível excluir grupos sem lançamentos vinculados",
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
