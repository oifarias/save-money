"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultAccountId } from "@/lib/accounts";
import { syncTransactionTags } from "@/lib/tags";
import { transactionSchema, batchCreateTransactionSchema } from "@/lib/validations/transaction";
import { bulkUpdateTransactionSchema } from "@/lib/validations/bulk-transaction";
import { resolveCategoryAndSubcategory } from "@/lib/category-resolver";
import {
  createInstallmentPlanWithTransactions,
  deleteInstallmentPlanCascade,
  propagateInstallmentEdit,
} from "@/lib/installment-resolver";
import { resolveFixedExpenseTemplate } from "@/lib/fixed-expense-resolver";
import { payFixedExpensesSchema } from "@/lib/validations/fixed-expense";
import { parseTransactionFilters, searchParamsToRecord } from "@/lib/validations/transaction-filters";
import { buildTransactionWhere } from "@/lib/transaction-filters";
import { getTransactionsPage } from "@/lib/transactions-query";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";
import type { TransactionListItem } from "@/components/transactions/transaction-list";
import { Prisma, type Recurrence, type TransactionType } from "@/generated/prisma/client";

const TX_TIMEOUT_MS = 30_000;
const TX_MAX_WAIT_MS = 10_000;

/** Invalida o cache (`unstable_cache`) das telas agregadas — chamar após qualquer mutação de Transaction. */
function invalidateAggregateCaches(userId: string) {
  revalidateTag(dashboardCacheTag(userId), { expire: 0 });
  revalidateTag(comparativeCacheTag(userId), { expire: 0 });
  revalidateTag(insightsCacheTag(userId), { expire: 0 });
}

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
    isInstallment: formData.get("isInstallment") === "on",
    totalInstallments: String(formData.get("totalInstallments") ?? ""),
    currentInstallment: String(formData.get("currentInstallment") ?? ""),
    creditCardId: String(formData.get("creditCardId") ?? ""),
  });
}

export async function createTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const { type, date, description, amount, categoryId, subcategoryId, isFixed, recurrence, tags, isInstallment, totalInstallments, currentInstallment, creditCardId } =
    parsed.data;

  const accountId = await getDefaultAccountId(userId);
  if (!accountId) {
    return { success: false, message: "Nenhuma conta encontrada para o usuário" };
  }

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId ?? "", subcategoryId ?? "");
  if (error) {
    return { success: false, fieldErrors: error };
  }

  if (isInstallment && totalInstallments) {
    const startInstallmentNumber = currentInstallment ? Number(currentInstallment) : 1;
    await prisma.$transaction(async (tx) => {
      const { transactions } = await createInstallmentPlanWithTransactions(tx, userId, {
        baseDescription: description,
        totalInstallments: Number(totalInstallments),
        startInstallmentNumber,
        amount: Number(amount),
        startDate: new Date(date),
        type: type as TransactionType,
        accountId,
        categoryId,
        subcategoryId,
      });

      for (const created of transactions) {
        await syncTransactionTags(tx, userId, created.id, tags);
      }
    }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

    revalidatePath("/dashboard");
    revalidatePath("/lancamentos");
    invalidateAggregateCaches(userId);
    return { success: true, message: `Lançamento registrado com sucesso (${totalInstallments} parcelas geradas)` };
  }

  await prisma.$transaction(async (tx) => {
    const fixedExpenseInfo =
      type === "EXPENSE"
        ? await resolveFixedExpenseTemplate(tx, userId, {
            isFixed: Boolean(isFixed),
            description,
            date: new Date(date),
            amount: Number(amount),
            categoryId,
            subcategoryId,
            previousTemplateId: null,
          })
        : { fixedExpenseTemplateId: null };

    const created = await tx.transaction.create({
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
        installmentPlanId: null,
        installmentNumber: null,
        fixedExpenseTemplateId: fixedExpenseInfo.fixedExpenseTemplateId,
        creditCardId: creditCardId || null,
      },
    });

    await syncTransactionTags(tx, userId, created.id, tags);
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: "Lançamento registrado com sucesso" };
}

export async function updateTransactionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  const propagateToAll = formData.get("propagateToAll") === "on";
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const existing = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!existing) {
    return { success: false, message: "Lançamento não encontrado" };
  }

  const { type, date, description, amount, categoryId, subcategoryId, isFixed, recurrence, tags, creditCardId } = parsed.data;

  const { error } = await resolveCategoryAndSubcategory(userId, categoryId ?? "", subcategoryId ?? "");
  if (error) {
    return { success: false, fieldErrors: error };
  }

  await prisma.$transaction(async (tx) => {
    const installmentInfo = existing.installmentPlanId
      ? { installmentPlanId: existing.installmentPlanId, installmentNumber: existing.installmentNumber }
      : null;

    const fixedExpenseInfo =
      type === "EXPENSE"
        ? await resolveFixedExpenseTemplate(tx, userId, {
            isFixed: Boolean(isFixed),
            description,
            date: new Date(date),
            amount: Number(amount),
            categoryId,
            subcategoryId,
            excludeTransactionId: id,
            previousTemplateId: existing.fixedExpenseTemplateId,
          })
        : { fixedExpenseTemplateId: null };

    await tx.transaction.update({
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
        installmentPlanId: installmentInfo?.installmentPlanId ?? null,
        installmentNumber: installmentInfo?.installmentNumber ?? null,
        fixedExpenseTemplateId: fixedExpenseInfo.fixedExpenseTemplateId,
        creditCardId: creditCardId || null,
      },
    });

    await syncTransactionTags(tx, userId, id, tags);

    if (propagateToAll && installmentInfo?.installmentPlanId) {
      const siblingIds = await propagateInstallmentEdit(
        tx,
        userId,
        installmentInfo.installmentPlanId,
        { baseDescription: description, amount: Number(amount), categoryId, subcategoryId },
        id,
      );
      for (const siblingId of siblingIds) {
        await syncTransactionTags(tx, userId, siblingId, tags);
      }
    }
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
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
  invalidateAggregateCaches(userId);

  if (result.count !== ids.length) {
    return { success: false, message: "Alguns lançamentos não puderam ser atualizados" };
  }

  return { success: true, message: `${result.count} lançamento(s) atualizado(s) com sucesso` };
}

export async function loadMoreTransactionsAction(searchParamsString: string, page: number): Promise<TransactionListItem[]> {
  const userId = await requireUserId();
  const rawSearchParams = searchParamsToRecord(new URLSearchParams(searchParamsString));
  const filters = parseTransactionFilters(rawSearchParams);
  const where = await buildTransactionWhere(userId, filters);
  return getTransactionsPage(where, page);
}

/** Combinação (categoryId, subcategoryId) mais frequente entre as transações; empate vai para a mais recente. */
function pickCanonicalCategory(
  transactions: { categoryId: string | null; subcategoryId: string | null; date: Date }[]
): { categoryId: string | null; subcategoryId: string | null } {
  const counts = new Map<string, { categoryId: string | null; subcategoryId: string | null; count: number; latestDate: Date }>();

  for (const tx of transactions) {
    const pairKey = `${tx.categoryId ?? ""}::${tx.subcategoryId ?? ""}`;
    const entry = counts.get(pairKey);
    if (entry) {
      entry.count += 1;
      if (tx.date > entry.latestDate) entry.latestDate = tx.date;
    } else {
      counts.set(pairKey, { categoryId: tx.categoryId, subcategoryId: tx.subcategoryId, count: 1, latestDate: tx.date });
    }
  }

  const ranked = Array.from(counts.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.latestDate.getTime() - a.latestDate.getTime();
  });

  return { categoryId: ranked[0]?.categoryId ?? null, subcategoryId: ranked[0]?.subcategoryId ?? null };
}

/** Retira um snapshot de descrição/valor pra exibir no card de insight, mesmo quando variam entre as transações. */
function snapshotDescriptionAndAmount(transactions: { description: string; amount: number }[]) {
  const descriptions = Array.from(new Set(transactions.map((tx) => tx.description)));
  const amounts = Array.from(new Set(transactions.map((tx) => tx.amount)));
  return {
    description: descriptions.length === 1 ? descriptions[0] : `${descriptions.length} descrições diferentes`,
    amount: amounts.length === 1 ? amounts[0] : null,
  };
}

export async function acceptFixedExpenseInsightAction(groupKey: string, transactionIds: string[]): Promise<ActionResult> {
  const userId = await requireUserId();

  if (!groupKey || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return { success: false, message: "Seleção inválida" };
  }

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: transactionIds }, userId },
    select: { id: true, description: true, amount: true, date: true, categoryId: true, subcategoryId: true },
  });

  if (transactions.length !== transactionIds.length) {
    return { success: false, message: "Um ou mais lançamentos não foram encontrados" };
  }

  const canonical = pickCanonicalCategory(transactions);
  const snapshot = snapshotDescriptionAndAmount(transactions);

  await prisma.$transaction(async (tx) => {
    for (const transaction of transactions) {
      const fixedExpenseInfo = await resolveFixedExpenseTemplate(tx, userId, {
        isFixed: true,
        description: transaction.description,
        date: transaction.date,
        amount: transaction.amount,
        categoryId: canonical.categoryId,
        subcategoryId: canonical.subcategoryId,
        excludeTransactionId: transaction.id,
        previousTemplateId: null,
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          isFixed: true,
          categoryId: canonical.categoryId,
          subcategoryId: canonical.subcategoryId,
          fixedExpenseTemplateId: fixedExpenseInfo.fixedExpenseTemplateId,
        },
      });
    }
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  await prisma.fixedExpenseInsightDecision.upsert({
    where: { userId_groupKey: { userId, groupKey } },
    create: {
      userId,
      groupKey,
      status: "accepted",
      description: snapshot.description,
      amount: snapshot.amount,
      categoryId: canonical.categoryId,
      subcategoryId: canonical.subcategoryId,
      transactionIds,
    },
    update: {
      status: "accepted",
      description: snapshot.description,
      amount: snapshot.amount,
      categoryId: canonical.categoryId,
      subcategoryId: canonical.subcategoryId,
      transactionIds,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  revalidatePath("/insights");
  invalidateAggregateCaches(userId);

  return { success: true, message: `${transactions.length} lançamento(s) marcado(s) como despesa fixa` };
}

export async function dismissFixedExpenseInsightAction(groupKey: string, transactionIds: string[]): Promise<ActionResult> {
  const userId = await requireUserId();

  if (!groupKey || !Array.isArray(transactionIds) || transactionIds.length === 0) {
    return { success: false, message: "Seleção inválida" };
  }

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: transactionIds }, userId },
    select: { description: true, amount: true },
  });

  const snapshot = snapshotDescriptionAndAmount(transactions);

  await prisma.fixedExpenseInsightDecision.upsert({
    where: { userId_groupKey: { userId, groupKey } },
    create: {
      userId,
      groupKey,
      status: "dismissed",
      description: snapshot.description,
      amount: snapshot.amount,
      transactionIds,
    },
    update: { status: "dismissed", transactionIds },
  });

  revalidatePath("/insights");
  invalidateAggregateCaches(userId);

  return { success: true, message: "Sugestão removida" };
}

export async function deleteTransactionAction(
  id: string,
  installmentScope: "single" | "all" = "all"
): Promise<ActionResult> {
  const userId = await requireUserId();

  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
    select: { installmentPlanId: true, fixedExpenseTemplateId: true },
  });
  if (!existing) {
    return { success: false, message: "Lançamento não encontrado" };
  }

  await prisma.$transaction(async (tx) => {
    if (existing.installmentPlanId && installmentScope === "all") {
      await deleteInstallmentPlanCascade(tx, userId, existing.installmentPlanId);
    } else {
      await tx.transaction.delete({ where: { id } });
    }
    if (existing.fixedExpenseTemplateId && installmentScope !== "single") {
      await tx.fixedExpenseTemplate.deleteMany({
        where: { id: existing.fixedExpenseTemplateId, userId },
      });
    }
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);

  const message =
    existing.installmentPlanId && installmentScope === "all"
      ? "Todas as parcelas foram excluídas"
      : "Lançamento excluído com sucesso";
  return { success: true, message };
}

export async function bulkDeleteTransactionsAction(ids: string[]): Promise<ActionResult> {
  const userId = await requireUserId();

  if (ids.length === 0) return { success: false, message: "Nenhum lançamento selecionado" };

  const transactions = await prisma.transaction.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, installmentPlanId: true, fixedExpenseTemplateId: true },
  });

  const planIds = [...new Set(transactions.map((t) => t.installmentPlanId).filter((id): id is string => id !== null))];
  const simpleIds = transactions.filter((t) => !t.installmentPlanId).map((t) => t.id);
  const templateIds = [...new Set(transactions.map((t) => t.fixedExpenseTemplateId).filter((id): id is string => id !== null))];

  await prisma.$transaction(async (tx) => {
    for (const planId of planIds) {
      await deleteInstallmentPlanCascade(tx, userId, planId);
    }
    if (simpleIds.length > 0) {
      await tx.transaction.deleteMany({ where: { id: { in: simpleIds }, userId } });
    }
    if (templateIds.length > 0) {
      await tx.fixedExpenseTemplate.deleteMany({ where: { id: { in: templateIds }, userId } });
    }
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: `${transactions.length} lançamento(s) excluído(s) com sucesso` };
}

/**
 * Marca uma ou mais despesas fixas como pagas, em lote. Cada item pode ter valor e data de
 * pagamento próprios (diferentes do `expectedAmount`/`dueDay` do template). Itens com template
 * inexistente/de outro usuário/inativo, ou que já tenham um pagamento no mês de referência
 * (constraint `[fixedExpenseTemplateId, referenceMonth]`), são reportados como falha sem abortar
 * o restante do lote.
 */
export async function payFixedExpensesAction(items: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = payFixedExpensesSchema.safeParse(items);
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const accountId = await getDefaultAccountId(userId);
  if (!accountId) {
    return { success: false, message: "Nenhuma conta encontrada para o usuário" };
  }

  let processedCount = 0;
  let notFoundCount = 0;
  let alreadyPaidCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of parsed.data) {
      const template = await tx.fixedExpenseTemplate.findFirst({
        where: { id: item.templateId, userId, isActive: true },
      });

      if (!template) {
        notFoundCount += 1;
        continue;
      }

      const paidDate = new Date(item.paidDate);
      // Extrai "YYYY-MM" direto da string "YYYY-MM-DD" recebida do input, sem passar por
      // getters de Date (que usam o fuso local do processo) — evita que `paidDate` seja
      // interpretado como UTC e depois lido em fuso negativo, virando o mês errado.
      const referenceMonth = item.paidDate.slice(0, 7);

      try {
        await tx.transaction.create({
          data: {
            userId,
            accountId,
            categoryId: template.categoryId,
            subcategoryId: template.subcategoryId,
            type: "EXPENSE",
            amount: item.paidAmount,
            date: paidDate,
            description: template.description,
            isFixed: true,
            fixedExpenseTemplateId: template.id,
            referenceMonth,
          },
        });
        processedCount += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          alreadyPaidCount += 1;
          continue;
        }
        throw error;
      }
    }
  }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);

  if (processedCount === parsed.data.length) {
    return { success: true, message: `${processedCount} despesa(s) marcada(s) como paga(s)` };
  }

  const failureParts: string[] = [];
  if (alreadyPaidCount > 0) failureParts.push(`${alreadyPaidCount} já estava(m) paga(s) neste mês`);
  if (notFoundCount > 0) failureParts.push(`${notFoundCount} não foi(ram) encontrada(s)`);

  const failureMessage = failureParts.join("; ");
  const message =
    processedCount > 0
      ? `${processedCount} despesa(s) processada(s); ${failureMessage}`
      : `Nenhuma despesa foi processada: ${failureMessage}`;

  return { success: false, message };
}

export async function createTransactionBatchAction(items: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  const parsed = batchCreateTransactionSchema.safeParse({ items });
  if (!parsed.success) {
    return { success: false, fieldErrors: flattenZodErrors(parsed.error) };
  }

  const accountId = await getDefaultAccountId(userId);
  if (!accountId) {
    return { success: false, message: "Nenhuma conta encontrada para o usuário" };
  }

  for (const item of parsed.data.items) {
    const { error } = await resolveCategoryAndSubcategory(userId, item.categoryId ?? "", item.subcategoryId ?? "");
    if (error) {
      return { success: false, fieldErrors: error };
    }
  }

  let totalCreated = 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of parsed.data.items) {
        const { type, date, description, amount, categoryId, subcategoryId, isFixed, recurrence, tags, isInstallment, totalInstallments, currentInstallment, creditCardId } = item;

        if (isInstallment && totalInstallments) {
          const startInstallmentNumber = currentInstallment ? Number(currentInstallment) : 1;
          const { transactions } = await createInstallmentPlanWithTransactions(tx, userId, {
            baseDescription: description,
            totalInstallments: Number(totalInstallments),
            startInstallmentNumber,
            amount: Number(amount),
            startDate: new Date(date),
            type: type as TransactionType,
            accountId,
            categoryId,
            subcategoryId,
          });
          for (const created of transactions) {
            await syncTransactionTags(tx, userId, created.id, tags);
          }
          totalCreated += Number(totalInstallments);
        } else {
          const fixedExpenseInfo =
            type === "EXPENSE"
              ? await resolveFixedExpenseTemplate(tx, userId, {
                  isFixed: Boolean(isFixed),
                  description,
                  date: new Date(date),
                  amount: Number(amount),
                  categoryId,
                  subcategoryId,
                  previousTemplateId: null,
                })
              : { fixedExpenseTemplateId: null };

          const created = await tx.transaction.create({
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
              installmentPlanId: null,
              installmentNumber: null,
              fixedExpenseTemplateId: fixedExpenseInfo.fixedExpenseTemplateId,
              creditCardId: creditCardId || null,
            },
          });

          await syncTransactionTags(tx, userId, created.id, tags);
          totalCreated += 1;
        }
      }
    }, { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS });
  } catch {
    return { success: false, message: "Não foi possível salvar os lançamentos. Tente novamente." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: `${totalCreated} lançamento(s) registrado(s) com sucesso` };
}

export async function deleteFixedExpenseTemplateAction(templateId: unknown): Promise<ActionResult> {
  const userId = await requireUserId();

  if (typeof templateId !== "string" || !templateId) {
    return { success: false, message: "ID inválido" };
  }

  const template = await prisma.fixedExpenseTemplate.findFirst({
    where: { id: templateId, userId },
    select: { id: true },
  });

  if (!template) {
    return { success: false, message: "Despesa fixa não encontrada" };
  }

  await prisma.fixedExpenseTemplate.update({
    where: { id: templateId },
    data: { isActive: false },
  });

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  invalidateAggregateCaches(userId);
  return { success: true, message: "Despesa fixa removida" };
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
