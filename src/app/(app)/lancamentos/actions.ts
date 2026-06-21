"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAccountId } from "@/lib/accounts";
import { syncTransactionTags } from "@/lib/tags";
import { transactionSchema } from "@/lib/validations/transaction";
import { bulkUpdateTransactionSchema } from "@/lib/validations/bulk-transaction";
import { resolveCategoryAndSubcategory } from "@/lib/category-resolver";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { getTransactionsPage } from "@/lib/transactions-query";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import type { Prisma, Recurrence, TransactionType } from "@/generated/prisma/client";

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

export async function bulkUpdateTransactionsAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = bulkUpdateTransactionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { ids, categoryId, subcategoryId, amount, description, date } = parsed.data;
  const hasCategoryChange = categoryId !== undefined;
  const hasSubcategoryChange = subcategoryId !== undefined;

  if (!hasCategoryChange && !hasSubcategoryChange && amount === undefined && description === undefined && date === undefined) {
    return { success: false, message: "Selecione ao menos um campo para alterar" };
  }

  const existing = await prisma.transaction.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, categoryId: true },
  });

  if (existing.length !== ids.length) {
    return { success: false, message: "Um ou mais lançamentos não foram encontrados" };
  }

  const data: Prisma.TransactionUncheckedUpdateManyInput = {};

  if (hasCategoryChange) {
    if (categoryId) {
      const { error } = await resolveCategoryAndSubcategory(userId, categoryId, "");
      if (error) {
        return { success: false, fieldErrors: error };
      }
    }
    data.categoryId = categoryId || null;
  }

  if (hasSubcategoryChange) {
    if (subcategoryId) {
      const effectiveCategoryId = hasCategoryChange ? categoryId : existing[0]?.categoryId;
      const allShareCategory = existing.every((t) => t.categoryId === effectiveCategoryId);

      if (!effectiveCategoryId || !allShareCategory) {
        return {
          success: false,
          fieldErrors: { subcategoryId: "Os lançamentos selecionados precisam ter o mesmo grupo para alterar o sub-grupo em lote" },
        };
      }

      const { error } = await resolveCategoryAndSubcategory(userId, effectiveCategoryId, subcategoryId);
      if (error) {
        return { success: false, fieldErrors: error };
      }
    }
    data.subcategoryId = subcategoryId || null;
  } else if (hasCategoryChange) {
    data.subcategoryId = null;
  }

  if (amount !== undefined) data.amount = amount;
  if (description !== undefined) data.description = description;
  if (date !== undefined) data.date = new Date(date);

  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids }, userId },
    data,
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");

  if (result.count !== ids.length) {
    return { success: false, message: "Alguns lançamentos não puderam ser atualizados" };
  }

  return { success: true, message: `${result.count} lançamento(s) atualizado(s) com sucesso` };
}

export async function loadMoreTransactionsAction(searchParamsString: string, page: number): Promise<TransactionListItem[]> {
  const userId = await requireUserId();
  const rawSearchParams = Object.fromEntries(new URLSearchParams(searchParamsString));
  const filters = parseTransactionFilters(rawSearchParams);
  return getTransactionsPage(userId, filters, page);
}

export async function markTransactionsFixedAction(ids: string[]): Promise<ActionResult> {
  const userId = await requireUserId();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: "Selecione ao menos um lançamento" };
  }

  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids }, userId },
    data: { isFixed: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  revalidatePath("/insights");

  return { success: true, message: `${result.count} lançamento(s) marcado(s) como despesa fixa` };
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
