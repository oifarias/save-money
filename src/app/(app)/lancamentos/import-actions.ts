"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAccountId } from "@/lib/accounts";
import { syncTransactionTags } from "@/lib/tags";
import { findOrCreateRootCategory, findOrCreateSubcategory } from "@/lib/category-resolver";
import { normalizeTags, normalizeInstallments, normalizeFixedFlag } from "@/lib/import-helpers";
import { importRowSchema } from "@/lib/validations/import";
import { createInstallmentPlanWithTransactions, addMonths } from "@/lib/installment-resolver";
import { resolveFixedExpenseTemplate } from "@/lib/fixed-expense-resolver";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";
import { Prisma, type Category, type PrismaClient, type TransactionType } from "@/generated/prisma/client";

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
  installments: string;
  isFixed: string;
};

const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;
const IMPORT_TRANSACTION_MAX_WAIT_MS = 15_000;

type Tx = PrismaClient | Prisma.TransactionClient;

/**
 * Resolve (com cache em memória por importação) a categoria raiz para o nome informado.
 * Em corrida de criação concorrente (P2002 por @@unique([userId, parentId, name])), faz
 * fallback para buscar o registro já existente em vez de derrubar o lote.
 */
async function resolveRootCategoryCached(
  tx: Tx,
  userId: string,
  name: string,
  cache: Map<string, Category | null>
): Promise<Category | null> {
  const cacheKey = `root:${name}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  let record: Category | null;
  try {
    record = await findOrCreateRootCategory(tx, userId, name);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      record = await tx.category.findFirst({ where: { userId, name: name.trim(), parentId: null } });
    } else {
      throw error;
    }
  }

  cache.set(cacheKey, record);
  return record;
}

/** Mesma lógica de cache + fallback de corrida, para sub-categorias sob um pai específico. */
async function resolveSubcategoryCached(
  tx: Tx,
  userId: string,
  parentId: string,
  name: string,
  cache: Map<string, Category | null>
): Promise<Category | null> {
  const cacheKey = `sub:${parentId}:${name}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  let record: Category | null;
  try {
    record = await findOrCreateSubcategory(tx, userId, parentId, name);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      record = await tx.category.findFirst({ where: { userId, name: name.trim(), parentId } });
    } else {
      throw error;
    }
  }

  cache.set(cacheKey, record);
  return record;
}

export async function importTransactionsAction(rows: ImportRowPayload[]): Promise<ImportActionResult> {
  const userId = await requireUserId();

  if (rows.length === 0) {
    return { success: false, message: "Nenhuma linha válida para importar" };
  }
  if (rows.length > 1000) {
    return { success: false, message: "Limite máximo de 1000 linhas por importação" };
  }

  let imported = 0;
  let skipped = 0;

  await prisma.$transaction(
    async (tx) => {
      const accountId = await ensureDefaultAccountId(userId, tx);
      const categoryCache = new Map<string, Category | null>();

      for (const row of rows) {
        const parsed = importRowSchema.safeParse(row);
        if (!parsed.success) {
          skipped += 1;
          continue;
        }

        const { date, description, amount, type, category, subcategory, tags, installments, isFixed } = parsed.data;

        let categoryId: string | null = null;
        let subcategoryId: string | null = null;

        if (category) {
          const categoryRecord = await resolveRootCategoryCached(tx, userId, category, categoryCache);
          categoryId = categoryRecord?.id ?? null;
        }

        if (subcategory && categoryId) {
          const subcategoryRecord = await resolveSubcategoryCached(tx, userId, categoryId, subcategory, categoryCache);
          subcategoryId = subcategoryRecord?.id ?? null;
        }

        const rowDate = new Date(date);
        const parsedInstallments = normalizeInstallments(installments ?? "");
        const parsedTagNames = tags ? normalizeTags(tags) : [];

        if (parsedInstallments) {
          // A própria linha representa a parcela `current` — a data projetada da parcela 1
          // é obtida andando `current - 1` meses para trás a partir da data informada na linha.
          const planStartDate = addMonths(rowDate, -(parsedInstallments.current - 1));

          const { transactions } = await createInstallmentPlanWithTransactions(tx, userId, {
            baseDescription: description,
            totalInstallments: parsedInstallments.total,
            amount: Number(amount),
            startDate: planStartDate,
            type: type as TransactionType,
            accountId,
            categoryId,
            subcategoryId,
            startInstallmentNumber: parsedInstallments.current,
          });

          if (parsedTagNames.length > 0) {
            for (const created of transactions) {
              await syncTransactionTags(tx, userId, created.id, parsedTagNames);
            }
          }

          imported += transactions.length;
        } else {
          const isFixedFlag = normalizeFixedFlag(isFixed ?? "");

          let fixedExpenseTemplateId: string | null = null;
          if (isFixedFlag) {
            const result = await resolveFixedExpenseTemplate(tx, userId, {
              isFixed: true,
              description,
              date: rowDate,
              amount: Number(amount),
              categoryId,
              subcategoryId,
              previousTemplateId: null,
            });
            fixedExpenseTemplateId = result.fixedExpenseTemplateId;
          }

          const transaction = await tx.transaction.create({
            data: {
              userId,
              accountId,
              categoryId,
              subcategoryId,
              type: type as TransactionType,
              amount: Number(amount),
              date: rowDate,
              description,
              isFixed: isFixedFlag,
              fixedExpenseTemplateId,
              recurrence: "NONE",
            },
          });

          if (parsedTagNames.length > 0) {
            await syncTransactionTags(tx, userId, transaction.id, parsedTagNames);
          }

          imported += 1;
        }
      }
    },
    { timeout: IMPORT_TRANSACTION_TIMEOUT_MS, maxWait: IMPORT_TRANSACTION_MAX_WAIT_MS }
  );

  revalidatePath("/dashboard");
  revalidatePath("/lancamentos");
  revalidatePath("/grupos");
  revalidateTag(dashboardCacheTag(userId), { expire: 0 });
  revalidateTag(comparativeCacheTag(userId), { expire: 0 });
  revalidateTag(insightsCacheTag(userId), { expire: 0 });

  return {
    success: true,
    imported,
    skipped,
    message: `${imported} lançamento(s) importado(s)${skipped > 0 ? ` · ${skipped} ignorado(s) por erro` : ""}`,
  };
}
