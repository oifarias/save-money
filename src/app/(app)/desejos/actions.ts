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
  createWishBatchSchema,
  createWishesBulkSchema,
  reorderWishesSchema,
} from "@/lib/validations/wish";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";
import { Prisma } from "@/generated/prisma/client";

/** Mensagem genérica para "não encontrado"/"pertence a outro usuário" — nunca diferenciar (evita IDOR/enumeração). */
const NOT_FOUND_MESSAGE = "Desejo não encontrado";
const GOAL_NOT_FOUND_MESSAGE = "Meta não encontrada";

export type ActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

/** Mesmo shape de `ActionResult`, com o id do desejo criado quando a operação é bem-sucedida. */
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

/**
 * Cria um novo desejo. Categoria e sub-grupo são obrigatórios (requisito de produto) e validados
 * via `resolveCategoryAndSubcategory`.
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

  const created = await prisma.$transaction(async (tx) => {
    const priority = await nextPriority(tx, userId);
    return tx.wish.create({
      data: {
        userId,
        name,
        estimatedAmount,
        categoryId,
        subcategoryId,
        notes: notes || null,
        imageUrl: imageUrl || null,
        priority,
      },
    });
  });

  revalidatePath("/desejos");
  return { success: true, message: "Desejo cadastrado com sucesso", wishId: created.id };
}

/** Próxima prioridade livre entre os desejos ACTIVE do usuário, escopada à transaction chamadora. */
async function nextPriority(tx: Prisma.TransactionClient, userId: string) {
  const last = await tx.wish.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { priority: "desc" },
    select: { priority: true },
  });
  return (last?.priority ?? 0) + 1;
}

/**
 * Cria vários itens de uma vez, todos no mesmo grupo/sub-grupo, cada um com seus próprios dados de
 * planejamento de compra (quando comprar, forma de pagamento, necessidade x desejo). Usado pelo
 * fluxo "Individual" da Lista de compras, que permite adicionar mais de um item por vez.
 */
export async function createWishBatchAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = createWishBatchSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { categoryId, subcategoryId, items } = parsed.data;

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId, subcategoryId);
  if (error) {
    return { success: false, fieldErrors: error };
  }

  await prisma.$transaction(async (tx) => {
    let priority = await nextPriority(tx, userId);
    for (const item of items) {
      const installmentAmount =
        item.paymentMethod === "INSTALLMENTS" && item.installmentsCount
          ? item.estimatedAmount / item.installmentsCount
          : null;

      await tx.wish.create({
        data: {
          userId,
          name: item.name,
          estimatedAmount: item.estimatedAmount,
          categoryId,
          subcategoryId,
          link: item.link || null,
          purchaseTiming: item.purchaseTiming,
          paymentMethod: item.paymentMethod,
          installmentsCount: item.paymentMethod === "INSTALLMENTS" ? item.installmentsCount : null,
          installmentAmount: item.paymentMethod === "INSTALLMENTS" ? installmentAmount : null,
          kind: item.kind,
          priority,
        },
      });
      priority += 1;
    }
  });

  revalidatePath("/desejos");
  return { success: true, message: `${items.length} item${items.length === 1 ? "" : "s"} cadastrado${items.length === 1 ? "" : "s"} com sucesso` };
}

/**
 * Cadastro em lote: vários itens no mesmo grupo/sub-grupo, apenas nome e valor estimado — sem
 * planejamento de compra detalhado (assume os padrões: à vista, este mês, desejo).
 */
export async function createWishesBulkAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = createWishesBulkSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { categoryId, subcategoryId, items } = parsed.data;

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId, subcategoryId);
  if (error) {
    return { success: false, fieldErrors: error };
  }

  await prisma.$transaction(async (tx) => {
    let priority = await nextPriority(tx, userId);
    for (const item of items) {
      await tx.wish.create({
        data: {
          userId,
          name: item.name,
          estimatedAmount: item.estimatedAmount,
          categoryId,
          subcategoryId,
          priority,
        },
      });
      priority += 1;
    }
  });

  revalidatePath("/desejos");
  return { success: true, message: `${items.length} item${items.length === 1 ? "" : "s"} cadastrado${items.length === 1 ? "" : "s"} com sucesso` };
}

/**
 * Reordena a prioridade dos desejos ACTIVE do usuário (drag-and-drop). Verifica que TODOS os ids
 * recebidos pertencem ao usuário autenticado antes de aplicar qualquer mudança — um usuário malicioso
 * não pode incluir ids de outro usuário para afetá-los.
 */
export async function reorderWishesAction(input: unknown): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = reorderWishesSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { wishIds } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const owned = await tx.wish.findMany({ where: { id: { in: wishIds }, userId }, select: { id: true } });
      if (owned.length !== wishIds.length) {
        throw new Error(NOT_FOUND_MESSAGE);
      }

      await Promise.all(
        wishIds.map((id, index) => tx.wish.update({ where: { id }, data: { priority: index + 1 } }))
      );
    });
  } catch (e) {
    if (e instanceof Error && e.message === NOT_FOUND_MESSAGE) {
      return { success: false, message: NOT_FOUND_MESSAGE };
    }
    throw e;
  }

  revalidatePath("/desejos");
  return { success: true };
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
        const purchaseDate = new Date(date as string);
        let installmentPlanId: string | null = null;

        if (wish.paymentMethod === "INSTALLMENTS" && wish.installmentsCount) {
          // Só agora, com a compra confirmada, o parcelamento passa a comprometer o orçamento via InstallmentPlan —
          // nunca no cadastro do desejo, para não poluir a projeção com parcelamentos especulativos.
          const plan = await tx.installmentPlan.create({
            data: {
              userId,
              baseDescription: wish.name,
              totalInstallments: wish.installmentsCount,
              estimatedAmount: wish.installmentAmount ?? (amount as number) / wish.installmentsCount,
              startDate: purchaseDate,
              categoryId: wish.categoryId,
              subcategoryId: wish.subcategoryId,
            },
          });
          installmentPlanId = plan.id;
        }

        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: accountId as string,
            categoryId: wish.categoryId,
            subcategoryId: wish.subcategoryId,
            type: "EXPENSE",
            amount: amount as number,
            date: purchaseDate,
            description: wish.name,
            installmentPlanId,
            installmentNumber: installmentPlanId ? 1 : null,
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
