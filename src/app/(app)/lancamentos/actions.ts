"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAccountId } from "@/lib/accounts";
import { syncTransactionTags } from "@/lib/tags";
import { transactionSchema } from "@/lib/validations/transaction";
import type { Recurrence, TransactionType } from "@/generated/prisma/client";

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

function parseFormData(formData: FormData) {
  const tagsRaw = formData.get("tags");
  let tags: string[] = [];
  if (typeof tagsRaw === "string" && tagsRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(tagsRaw);
      if (Array.isArray(parsed)) {
        tags = parsed.filter((tag): tag is string => typeof tag === "string");
      }
    } catch {
      tags = [];
    }
  }

  return transactionSchema.safeParse({
    type: String(formData.get("type") ?? ""),
    date: String(formData.get("date") ?? ""),
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    subcategoryId: String(formData.get("subcategoryId") ?? ""),
    isFixed: formData.get("isFixed") === "on",
    recurrence: String(formData.get("recurrence") ?? "NONE"),
    tags,
  });
}

async function resolveCategoryAndSubcategory(
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

export async function createTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { type, date, description, amount, categoryId, subcategoryId, isFixed, recurrence, tags } = parsed.data;

  const accountId = await getDefaultAccountId(userId);
  if (!accountId) {
    return { success: false, message: "Nenhuma conta encontrada para o usuário" };
  }

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId ?? "", subcategoryId ?? "");
  if (error) {
    return { success: false, fieldErrors: error };
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      accountId,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      type: type as TransactionType,
      amount: Number(amount),
      date: new Date(date),
      description,
      isFixed: Boolean(isFixed),
      recurrence: recurrence as Recurrence,
    },
  });

  await syncTransactionTags(prisma, userId, transaction.id, tags);

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  return { success: true, message: "Lançamento registrado com sucesso" };
}

export async function updateTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) {
    return { success: false, message: "Lançamento não encontrado" };
  }

  const { type, date, description, amount, categoryId, subcategoryId, isFixed, recurrence, tags } = parsed.data;

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId ?? "", subcategoryId ?? "");
  if (error) {
    return { success: false, fieldErrors: error };
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      type: type as TransactionType,
      amount: Number(amount),
      date: new Date(date),
      description,
      isFixed: Boolean(isFixed),
      recurrence: recurrence as Recurrence,
    },
  });

  await syncTransactionTags(prisma, userId, id, tags);

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  return { success: true, message: "Lançamento atualizado com sucesso" };
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) {
    return { success: false, message: "Lançamento não encontrado" };
  }

  await prisma.transaction.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  return { success: true, message: "Lançamento excluído com sucesso" };
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
