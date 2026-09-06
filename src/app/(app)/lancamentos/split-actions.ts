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

  const { title, mode, showCategories, items, participants } = parsed.data;

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: items.map((i) => i.transactionId) }, userId, type: "EXPENSE" },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      category: { select: { name: true, color: true } },
    },
  });
  const txById = new Map(transactions.map((t) => [t.id, t]));
  const validItems = items.filter((item) => txById.has(item.transactionId));

  if (validItems.length === 0) {
    return { success: false, message: "Nenhuma despesa válida foi selecionada" };
  }

  const total = validItems.reduce((sum, item) => sum + txById.get(item.transactionId)!.amount, 0);

  // Totais por participante calculados antes do write, para não depender de update pós-create.
  const participantTotals =
    mode === "equal"
      ? participants.map(() => total / participants.length)
      : participants.map((_, index) =>
          validItems.reduce(
            (sum, item) =>
              sum + item.shares.filter((s) => s.participantIndex === index).reduce((acc, s) => acc + s.amount, 0),
            0
          )
        );

  const splitId = randomUUID();
  const token = randomUUID();

  const participantRows = participants.map((p, index) => ({
    id: randomUUID(),
    sharedSplitId: splitId,
    name: p.name,
    amount: participantTotals[index],
    position: index,
  }));

  const itemRows = validItems.map((item) => {
    const t = txById.get(item.transactionId)!;
    return {
      id: randomUUID(),
      sharedSplitId: splitId,
      description: t.description,
      amount: t.amount,
      date: t.date,
      note: item.note || null,
      categoryName: t.category?.name ?? null,
      categoryColor: t.category?.color ?? null,
    };
  });

  const shareRows =
    mode === "custom"
      ? validItems.flatMap((item, itemIndex) =>
          item.shares.map((share) => ({
            id: randomUUID(),
            sharedSplitItemId: itemRows[itemIndex].id,
            sharedSplitParticipantId: participantRows[share.participantIndex].id,
            amount: share.amount,
          }))
        )
      : [];

  await prisma.$transaction(async (tx) => {
    await tx.sharedSplit.create({ data: { id: splitId, userId, token, title, mode, showCategories } });
    await tx.sharedSplitParticipant.createMany({ data: participantRows });
    await tx.sharedSplitItem.createMany({ data: itemRows });
    if (shareRows.length > 0) {
      await tx.sharedSplitItemShare.createMany({ data: shareRows });
    }
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
