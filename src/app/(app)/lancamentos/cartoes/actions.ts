"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { creditCardSchema } from "@/lib/validations/credit-card";

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado");
  return session.user.id;
}

function flattenZodErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function createCreditCardAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = creditCardSchema.safeParse({
    bankCode: String(formData.get("bankCode") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    limit: String(formData.get("limit") ?? ""),
    dueDay: String(formData.get("dueDay") ?? ""),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { bankCode, nickname, limit, dueDay } = parsed.data;

  await prisma.creditCard.create({
    data: {
      userId,
      bankCode,
      nickname: nickname || null,
      limit,
      dueDay,
    },
  });

  revalidatePath("/lancamentos/cartoes");
  return { success: true, message: "Cartão cadastrado com sucesso" };
}

export async function updateCreditCardAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const existing = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!existing) return { success: false, message: "Cartão não encontrado" };

  const parsed = creditCardSchema.safeParse({
    bankCode: String(formData.get("bankCode") ?? ""),
    nickname: String(formData.get("nickname") ?? ""),
    limit: String(formData.get("limit") ?? ""),
    dueDay: String(formData.get("dueDay") ?? ""),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { bankCode, nickname, limit, dueDay } = parsed.data;

  await prisma.creditCard.update({
    where: { id },
    data: { bankCode, nickname: nickname || null, limit, dueDay },
  });

  revalidatePath("/lancamentos/cartoes");
  return { success: true, message: "Cartão atualizado com sucesso" };
}

export async function deleteCreditCardAction(id: string): Promise<ActionResult> {
  const userId = await requireUserId();

  const existing = await prisma.creditCard.findFirst({ where: { id, userId } });
  if (!existing) return { success: false, message: "Cartão não encontrado" };

  await prisma.creditCard.delete({ where: { id } });

  revalidatePath("/lancamentos/cartoes");
  return { success: true, message: "Cartão excluído" };
}
