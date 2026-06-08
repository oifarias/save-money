"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
};

export async function importTransactionsAction(
  accountId: string,
  categoryId: string,
  rows: ImportRowPayload[]
): Promise<ImportActionResult> {
  const userId = await requireUserId();

  if (!accountId) {
    return { success: false, message: "Selecione a conta de destino" };
  }
  if (rows.length === 0) {
    return { success: false, message: "Nenhuma linha válida para importar" };
  }
  if (rows.length > 1000) {
    return { success: false, message: "Limite máximo de 1000 linhas por importação" };
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId } });
  if (!account) {
    return { success: false, message: "Conta inválida" };
  }

  if (categoryId) {
    const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) {
      return { success: false, message: "Grupo inválido" };
    }
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

      const { date, description, amount, type } = parsed.data;
      await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: categoryId || null,
          type: type as TransactionType,
          amount: Number(amount),
          date: new Date(date),
          description,
          isFixed: false,
          recurrence: "NONE",
        },
      });
      imported += 1;
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");

  return {
    success: true,
    imported,
    skipped,
    message: `${imported} lançamento(s) importado(s)${skipped > 0 ? ` · ${skipped} ignorado(s) por erro` : ""}`,
  };
}
