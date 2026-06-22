"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSplitSchema } from "@/lib/validations/split";

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export type CreateSplitResult = ActionResult & { token?: string };

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Não autenticado");
  }
  return session.user.id;
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

/**
 * Cria o link de divisão. Grava um snapshot (descrição/valor/data) dos lançamentos selecionados
 * em vez de referenciá-los: se o usuário editar ou excluir o lançamento depois, o link já
 * compartilhado não pode quebrar nem mudar silenciosamente o que a outra pessoa já viu.
 */
export async function createSplitAction(input: unknown): Promise<CreateSplitResult> {
  const userId = await requireUserId();
  const parsed = createSplitSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { title, mode, transactionIds, participants } = parsed.data;

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: transactionIds }, userId, type: "EXPENSE" },
    select: { description: true, amount: true, date: true },
  });

  if (transactions.length === 0) {
    return { success: false, message: "Nenhuma despesa válida foi selecionada" };
  }

  const token = randomUUID();

  await prisma.sharedSplit.create({
    data: {
      userId,
      token,
      title,
      mode,
      items: {
        create: transactions.map((t) => ({ description: t.description, amount: t.amount, date: t.date })),
      },
      participants: {
        create: participants.map((p, index) => ({ name: p.name, amount: p.amount, position: index })),
      },
    },
  });

  revalidatePath("/lancamentos");

  return { success: true, token };
}

export async function deleteSplitAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const existing = await prisma.sharedSplit.findFirst({ where: { id, userId } });
  if (!existing) {
    return { success: false, message: "Link não encontrado" };
  }

  await prisma.sharedSplit.delete({ where: { id } });

  revalidatePath("/lancamentos");
  return { success: true, message: "Link excluído" };
}
