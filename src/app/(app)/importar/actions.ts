"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAccountId } from "@/lib/accounts";
import { syncTransactionTags } from "@/lib/tags";
import { findOrCreateRootCategory, findOrCreateSubcategory } from "@/lib/category-resolver";
import { normalizeTags } from "@/lib/import-helpers";
import { importRowSchema } from "@/lib/validations/import";
import type { TransactionType } from "@/generated/prisma/client";

export type ImportActionResult = {
  success: boolean;
  message?: string;
  imported?: number;
  skipped?: number;
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  return session.user.id;
}

export type ImportRowPayload = {
  date: string;
  description: string;
  amount: string;
  type: string;
  category: string;
  subcategory: string;
  tags: string;
};

export async function importTransactionsAction(rows: ImportRowPayload[]): Promise<ImportActionResult> {
  const userId = await requireUserId();

  if (rows.length === 0) {
    return { success: false, message: "Nenhuma linha válida para importar" };
  }
  if (rows.length > 1000) {
    return { success: false, message: "Limite máximo de 1000 linhas por importação" };
  }

  const accountId = await getDefaultAccountId(userId);
  if (!accountId) {
    return { success: false, message: "Nenhuma conta encontrada para o usuário" };
  }

  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const parsed = importRowSchema.safeParse(row);
      if (!parsed.success) {
        skipped += 1;
        continue;
      }

      const { date, description, amount, type, category, subcategory, tags } = parsed.data;

      if (subcategory && !category) {
        skipped += 1;
        continue;
      }

      let categoryId: string | null = null;
      let subcategoryId: string | null = null;

      if (category) {
        const categoryRecord = await findOrCreateRootCategory(tx, userId, category);
        categoryId = categoryRecord?.id ?? null;
      }

      if (subcategory && categoryId) {
        const subcategoryRecord = await findOrCreateSubcategory(tx, userId, categoryId, subcategory);
        subcategoryId = subcategoryRecord?.id ?? null;
      }

      const transaction = await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId,
          subcategoryId,
          type: type as TransactionType,
          amount: Number(amount),
          date: new Date(date),
          description,
          isFixed: false,
          recurrence: "NONE",
        },
      });

      if (tags) {
        await syncTransactionTags(tx, userId, transaction.id, normalizeTags(tags));
      }

      imported += 1;
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  revalidatePath("/grupos");

  return {
    success: true,
    imported,
    skipped,
    message: `${imported} lançamento(s) importado(s)${skipped > 0 ? ` · ${skipped} ignorado(s) por erro` : ""}`,
  };
}
