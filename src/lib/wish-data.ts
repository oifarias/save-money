import { prisma } from "@/lib/prisma";
import {
  currentMonthKey,
  getInstallmentCommitmentsByCategoryBatch,
  getBudgetProgress,
  getCategoryHistoricalAverages,
  type BudgetProgress,
} from "@/lib/budget-data";
import { evaluateWishReadiness, type WishReadiness } from "@/lib/wish-readiness";
import type { WishKind, WishPaymentMethod, WishPurchaseTiming, WishStatus } from "@/generated/prisma/client";

const READINESS_HORIZON_MONTHS = 12;

function nextMonthKeyOf(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const next = new Date(year, month, 1); // month já é 1-indexado na string, então `month` aqui é o mês seguinte (0-indexado)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonthsKeysFrom(monthKey: string, count: number) {
  const keys = [monthKey];
  for (let i = 1; i < count; i++) {
    keys.push(nextMonthKeyOf(keys[i - 1]));
  }
  return keys;
}

export type WishCategoryMeta = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type WishGoalSummary = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  progressPercent: number;
};

export type WishSummary = {
  id: string;
  name: string;
  estimatedAmount: number;
  status: WishStatus;
  priority: number;
  link: string | null;
  kind: WishKind;
  purchaseTiming: WishPurchaseTiming;
  paymentMethod: WishPaymentMethod;
  installmentsCount: number | null;
  installmentAmount: number | null;
  notes: string | null;
  imageUrl: string | null;
  purchasedAt: string | null;
  purchasedTransactionId: string | null;
  abandonedAt: string | null;
  abandonReason: string | null;
  createdAt: string;
  category: WishCategoryMeta;
  subcategory: WishCategoryMeta;
  goal: WishGoalSummary | null;
  readiness: WishReadiness | null;
};

export type WishesPageData = {
  active: WishSummary[];
  purchased: WishSummary[];
  abandoned: WishSummary[];
};

const CATEGORY_SELECT = { id: true, name: true, color: true, icon: true } as const;

const WISH_INCLUDE = {
  category: { select: CATEGORY_SELECT },
  subcategory: { select: CATEGORY_SELECT },
  goal: { select: { id: true, name: true, targetAmount: true, currentAmount: true, deadline: true } },
} as const;

type WishRow = {
  id: string;
  name: string;
  estimatedAmount: number;
  status: WishStatus;
  priority: number;
  link: string | null;
  kind: WishKind;
  purchaseTiming: WishPurchaseTiming;
  paymentMethod: WishPaymentMethod;
  installmentsCount: number | null;
  installmentAmount: number | null;
  notes: string | null;
  imageUrl: string | null;
  purchasedAt: Date | null;
  purchasedTransactionId: string | null;
  abandonedAt: Date | null;
  abandonReason: string | null;
  createdAt: Date;
  category: WishCategoryMeta;
  subcategory: WishCategoryMeta;
  goal: { id: string; name: string; targetAmount: number; currentAmount: number; deadline: Date | null } | null;
};

/**
 * Calcula, para um conjunto de desejos ativos, a timeline de compra à vista e a calculadora de
 * economia, reaproveitando uma única chamada por mês a `getInstallmentCommitmentsByCategory` e
 * uma única chamada a `getBudgetProgress`/`getCategoryHistoricalAverages` por usuário — nunca uma
 * chamada redundante por desejo, mesmo que vários desejos compartilhem a mesma categoria.
 */
async function evaluateReadinessForWishes(
  userId: string,
  wishes: WishRow[],
  preloadedBudgetProgress?: BudgetProgress | null
): Promise<Map<string, WishReadiness>> {
  const currentMonth = currentMonthKey();
  const horizonMonthKeys = nextMonthsKeysFrom(currentMonth, READINESS_HORIZON_MONTHS);

  const [committedByMonthMap, budgetProgress, historicalAverages] = await Promise.all([
    getInstallmentCommitmentsByCategoryBatch(userId, horizonMonthKeys),
    preloadedBudgetProgress !== undefined
      ? Promise.resolve(preloadedBudgetProgress)
      : getBudgetProgress(userId, currentMonth),
    getCategoryHistoricalAverages(userId),
  ]);

  const budgetLimitByCategory = new Map(budgetProgress?.categories.map((c) => [c.categoryId, c.limitAmount]) ?? []);
  const monthlySavingsCapacity = budgetProgress
    ? Math.max(0, budgetProgress.income - budgetProgress.necessidade.limit - budgetProgress.desejo.limit)
    : null;

  const readinessByWishId = new Map<string, WishReadiness>();
  for (const wish of wishes) {
    const readiness = evaluateWishReadiness({
      estimatedAmount: wish.estimatedAmount,
      goal: wish.goal
        ? { currentAmount: wish.goal.currentAmount, targetAmount: wish.goal.targetAmount, deadline: wish.goal.deadline }
        : null,
      budgetLimit: budgetLimitByCategory.get(wish.category.id) ?? null,
      categoryHistoricalAverage: historicalAverages.get(wish.category.id) ?? 0,
      committedByMonth: horizonMonthKeys.map((monthKey) => ({
        monthKey,
        committed: committedByMonthMap.get(monthKey)?.get(wish.category.id) ?? 0,
      })),
      monthlySavingsCapacity,
    });
    readinessByWishId.set(wish.id, readiness);
  }
  return readinessByWishId;
}

function toGoalSummary(goal: WishRow["goal"]): WishGoalSummary | null {
  if (!goal) return null;
  const progressPercent = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  return {
    id: goal.id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    currentAmount: goal.currentAmount,
    deadline: goal.deadline ? goal.deadline.toISOString() : null,
    progressPercent,
  };
}

function toWishSummary(wish: WishRow, readiness: WishReadiness | null): WishSummary {
  return {
    id: wish.id,
    name: wish.name,
    estimatedAmount: wish.estimatedAmount,
    status: wish.status,
    priority: wish.priority,
    link: wish.link,
    kind: wish.kind,
    purchaseTiming: wish.purchaseTiming,
    paymentMethod: wish.paymentMethod,
    installmentsCount: wish.installmentsCount,
    installmentAmount: wish.installmentAmount,
    notes: wish.notes,
    imageUrl: wish.imageUrl,
    purchasedAt: wish.purchasedAt ? wish.purchasedAt.toISOString() : null,
    purchasedTransactionId: wish.purchasedTransactionId,
    abandonedAt: wish.abandonedAt ? wish.abandonedAt.toISOString() : null,
    abandonReason: wish.abandonReason,
    createdAt: wish.createdAt.toISOString(),
    category: wish.category,
    subcategory: wish.subcategory,
    goal: toGoalSummary(wish.goal),
    readiness,
  };
}

/**
 * Busca todos os desejos do usuário, agrupados por desfecho (`active`/`purchased`/`abandoned`).
 * Para os `ACTIVE`, calcula a elegibilidade de compra ("pode comprar") via `evaluateWishReadiness`.
 */
export async function getWishesPageData(userId: string, budgetProgress: BudgetProgress | null): Promise<WishesPageData> {
  const wishes = (await prisma.wish.findMany({
    where: { userId },
    include: WISH_INCLUDE,
    orderBy: { createdAt: "desc" },
  })) as WishRow[];

  const activeWishes = wishes.filter((w) => w.status === "ACTIVE");
  const readinessByWishId = await evaluateReadinessForWishes(userId, activeWishes, budgetProgress);

  const active: WishSummary[] = [];
  const purchased: WishSummary[] = [];
  const abandoned: WishSummary[] = [];

  for (const wish of wishes) {
    const readiness = readinessByWishId.get(wish.id) ?? null;
    const summary = toWishSummary(wish, readiness);
    if (wish.status === "ACTIVE") active.push(summary);
    else if (wish.status === "PURCHASED") purchased.push(summary);
    else abandoned.push(summary);
  }

  active.sort((a, b) => a.priority - b.priority);

  return { active, purchased, abandoned };
}

/** Mesma lógica de `getWishesPageData`, escopada a um único desejo — usada na página de detalhe. */
export async function getWishDetail(userId: string, wishId: string): Promise<WishSummary | null> {
  const wish = (await prisma.wish.findFirst({
    where: { id: wishId, userId },
    include: WISH_INCLUDE,
  })) as WishRow | null;

  if (!wish) return null;

  if (wish.status !== "ACTIVE") {
    return toWishSummary(wish, null);
  }

  const readinessByWishId = await evaluateReadinessForWishes(userId, [wish]);
  return toWishSummary(wish, readinessByWishId.get(wish.id) ?? null);
}
