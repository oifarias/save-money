"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAccountId } from "@/lib/accounts";
import { resolveCategoryAndSubcategory } from "@/lib/category-resolver";
import {
  createWishSchema,
  linkWishGoalSchema,
  addWishContributionSchema,
  markWishPurchasedSchema,
  abandonWishSchema,
} from "@/lib/validations/wish";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";
import { Prisma } from "@/generated/prisma/client";

/** Mensagem genérica para "não encontrado"/"pertence a outro usuário" — nunca diferenciar (evita IDOR/enumeração). */
const NOT_FOUND_MESSAGE = "Desejo não encontrado";
const GOAL_NOT_FOUND_MESSAGE = "Meta não encontrada";

/** Desejos com valor estimado a partir deste limite entram em cooling-off automático. */
const COOLING_OFF_THRESHOLD = 300;
/** Duração do cooling-off, em dias corridos, a partir do cadastro. */
const COOLING_OFF_DAYS = 3;

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

/**
 * Mesmo shape de `ActionResult`, com o id do desejo criado quando a operação é bem-sucedida — usado
 * pelo modal de cadastro para encadear o convite opcional de estratégia (`linkWishGoalAction`) sem
 * precisar de uma segunda consulta.
 */
export type CreateWishResult = ActionResult & { wishId?: string };

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

function invalidateAggregateCaches(userId: string) {
  revalidateTag(dashboardCacheTag(userId), { expire: 0 });
  revalidateTag(comparativeCacheTag(userId), { expire: 0 });
  revalidateTag(insightsCacheTag(userId), { expire: 0 });
}

function addDays(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 24 * 60 * 60 * 1000);
}

/**
 * Cria um novo desejo. Categoria e sub-grupo são obrigatórios (requisito de produto) e validados
 * via `resolveCategoryAndSubcategory`. Desejos com `estimatedAmount >= 300` entram automaticamente
 * em cooling-off de 3 dias corridos a partir do cadastro (fricção saudável, nunca um bloqueio
 * silencioso — a UI deve sempre explicar o motivo e mostrar a contagem).
 */
export async function createWishAction(input: unknown): Promise<CreateWishResult> {
  const userId = await requireUserId();
  const parsed = createWishSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { name, estimatedAmount, categoryId, subcategoryId, notes, imageUrl } = parsed.data;

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId, subcategoryId);
  if (error) {
    return { success: false, fieldErrors: error };
  }

  const coolingOffUntil = estimatedAmount >= COOLING_OFF_THRESHOLD ? addDays(new Date(), COOLING_OFF_DAYS) : null;

  const created = await prisma.wish.create({
    data: {
      userId,
      name,
      estimatedAmount,
      categoryId,
      subcategoryId,
      notes: notes || null,
      imageUrl: imageUrl || null,
      coolingOffUntil,
    },
  });

  revalidatePath("/desejos");
  return { success: true, message: "Desejo cadastrado com sucesso", wishId: created.id };
}

/**
 * Vincula uma estratégia de economia (`Goal`) a um desejo: ou uma `Goal` já existente do usuário
 * (que ainda não esteja vinculada a outro desejo), ou cria uma nova `Goal` com `wishId` já setado.
 * Verificação de propriedade do `Wish` (e, quando aplicável, da `Goal`) ocorre dentro da mesma
 * `prisma.$transaction` que faz a mutação, evitando TOCTOU.
 */
export async function linkWishGoalAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = linkWishGoalSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { wishId, goalId, name, targetAmount, deadline } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const wish = await tx.wish.findFirst({ where: { id: wishId, userId } });
      if (!wish) {
        throw new Error(NOT_FOUND_MESSAGE);
      }

      if (goalId) {
        const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });
        if (!goal) {
          throw new Error(GOAL_NOT_FOUND_MESSAGE);
        }
        if (goal.wishId && goal.wishId !== wishId) {
          throw new Error("Esta meta já está vinculada a outro desejo");
        }
        await tx.goal.update({ where: { id: goalId }, data: { wishId } });
        return;
      }

      await tx.goal.create({
        data: {
          userId,
          wishId,
          categoryId: wish.categoryId,
          name: name?.trim() || wish.name,
          targetAmount: targetAmount as number,
          deadline: deadline ? new Date(deadline) : null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, message: "Esta meta já está vinculada a outro desejo" };
    }
    if (e instanceof Error && [NOT_FOUND_MESSAGE, GOAL_NOT_FOUND_MESSAGE].includes(e.message)) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }
    if (e instanceof Error) {
      return { success: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/desejos");
  revalidatePath(`/desejos/${wishId}`);
  revalidatePath("/metas");
  return { success: true, message: "Estratégia de economia vinculada ao desejo" };
}

/**
 * Aporta um valor agora na `Goal` vinculada ao desejo (`currentAmount += amount`). Primeira
 * implementação de "aportar em uma Goal" no projeto — o módulo de Metas de economia pode
 * reaproveitar a mesma ideia depois.
 */
export async function addWishContributionAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = addWishContributionSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { wishId, amount } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const wish = await tx.wish.findFirst({ where: { id: wishId, userId }, include: { goal: true } });
      if (!wish) {
        throw new Error(NOT_FOUND_MESSAGE);
      }
      if (!wish.goal) {
        throw new Error("Este desejo ainda não tem uma estratégia de economia vinculada");
      }

      await tx.goal.update({
        where: { id: wish.goal.id },
        data: { currentAmount: wish.goal.currentAmount + amount },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === NOT_FOUND_MESSAGE) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }
    if (e instanceof Error) {
      return { success: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/desejos");
  revalidatePath(`/desejos/${wishId}`);
  revalidatePath("/metas");
  return { success: true, message: "Aporte registrado com sucesso" };
}

/**
 * Marca um desejo como comprado. Opcionalmente cria uma `Transaction` real (valor pode divergir
 * do estimado) e a vincula via `purchasedTransactionId`. `findFirst` escopado por `userId` ocorre
 * dentro da mesma transaction que faz a mutação.
 */
export async function markWishPurchasedAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = markWishPurchasedSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { wishId, createTransaction, amount, date } = parsed.data;

  let accountId: string | null = null;
  if (createTransaction) {
    accountId = await getDefaultAccountId(userId);
    if (!accountId) {
      return { success: false, message: "Nenhuma conta encontrada para o usuário" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const wish = await tx.wish.findFirst({ where: { id: wishId, userId } });
      if (!wish) {
        throw new Error(NOT_FOUND_MESSAGE);
      }
      if (wish.status !== "ACTIVE") {
        throw new Error("Este desejo já foi concluído ou abandonado");
      }

      let purchasedTransactionId: string | null = null;

      if (createTransaction) {
        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: accountId as string,
            categoryId: wish.categoryId,
            subcategoryId: wish.subcategoryId,
            type: "EXPENSE",
            amount: amount as number,
            date: new Date(date as string),
            description: wish.name,
          },
        });
        purchasedTransactionId = created.id;
      }

      await tx.wish.update({
        where: { id: wishId },
        data: {
          status: "PURCHASED",
          purchasedAt: new Date(),
          purchasedTransactionId,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === NOT_FOUND_MESSAGE) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }
    if (e instanceof Error) {
      return { success: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/desejos");
  revalidatePath(`/desejos/${wishId}`);
  if (createTransaction) {
    revalidatePath("/dashboard");
    revalidatePath("/lancamentos");
    invalidateAggregateCaches(userId);
  }
  return { success: true, message: "Desejo marcado como comprado" };
}

/**
 * Abandona um desejo — desistir é uma decisão financeira legítima, não uma falha; nenhum dado é
 * apagado, o desejo permanece visível no histórico.
 */
export async function abandonWishAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = abandonWishSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { wishId, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const wish = await tx.wish.findFirst({ where: { id: wishId, userId } });
      if (!wish) {
        throw new Error(NOT_FOUND_MESSAGE);
      }
      if (wish.status !== "ACTIVE") {
        throw new Error("Este desejo já foi concluído ou abandonado");
      }

      await tx.wish.update({
        where: { id: wishId },
        data: {
          status: "ABANDONED",
          abandonedAt: new Date(),
          abandonReason: reason || null,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === NOT_FOUND_MESSAGE) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }
    if (e instanceof Error) {
      return { success: false, message: e.message };
    }
    throw e;
  }

  revalidatePath("/desejos");
  revalidatePath(`/desejos/${wishId}`);
  return { success: true, message: "Desejo movido para o histórico" };
}
