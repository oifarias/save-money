"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentMonthKey } from "@/lib/budget-data";
import { incomeBaselineSchema, budgetAllocationSchema } from "@/lib/validations/budget";

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

export async function saveIncomeBaselineAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = incomeBaselineSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const month = currentMonthKey();

  await prisma.budgetIncome.upsert({
    where: { userId_month: { userId, month } },
    create: { userId, month, amount: parsed.data.amount, source: parsed.data.source },
    update: { amount: parsed.data.amount, source: parsed.data.source },
  });

  revalidatePath("/metas");
  return { success: true, message: "Renda registrada" };
}

export async function saveBudgetAllocationAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = budgetAllocationSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { items } = parsed.data;
  const categoryIds = items.map((item) => item.categoryId);

  const ownedCategories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, userId, parentId: null },
    select: { id: true },
  });

  if (ownedCategories.length !== categoryIds.length) {
    return { success: false, message: "Um ou mais grupos são inválidos" };
  }

  const month = currentMonthKey();

  await prisma.$transaction(async (tx) => {
    await tx.budget.deleteMany({ where: { userId, month, categoryId: { notIn: categoryIds } } });

    for (const item of items) {
      await tx.budget.upsert({
        where: { userId_categoryId_month: { userId, categoryId: item.categoryId, month } },
        create: { userId, categoryId: item.categoryId, month, limitAmount: item.limitAmount, bucket: item.bucket },
        update: { limitAmount: item.limitAmount, bucket: item.bucket },
      });
    }
  });

  revalidatePath("/metas");
  revalidatePath("/dashboard");
  return { success: true, message: "Metas de gastos salvas com sucesso" };
}
