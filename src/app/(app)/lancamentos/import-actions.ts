"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAccountId } from "@/lib/accounts";
import { batchResolveTags } from "@/lib/tags";
import { batchResolveRootCategories, batchResolveSubcategories, subcategoryKey } from "@/lib/category-resolver";
import { normalizeTags, normalizeInstallments, normalizeFixedFlag, type NormalizedInstallments } from "@/lib/import-helpers";
import { importRowSchema } from "@/lib/validations/import";
import { addMonths } from "@/lib/installment-resolver";
import { batchResolveFixedExpenseTemplates, fixedExpenseTemplateKey } from "@/lib/fixed-expense-resolver";
import { dashboardCacheTag } from "@/lib/dashboard-data";
import { comparativeCacheTag } from "@/lib/comparative-data";
import { insightsCacheTag } from "@/lib/insights-data";
import type { TransactionType } from "@/generated/prisma/client";

export type ImportActionResult = {
  success: boolean;
  message?: string;
  imported?: number;
  skipped?: number;
  duplicatesSkipped?: number;
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
  creditCard?: string;
};

// Timeout da mini-tx por linha de parcelamento (plan + N transactions devem ser atômicos entre
// si, mas cada plano é independente dos demais — isso evita o estouro da tx global).
const ROW_TX_TIMEOUT_MS = 30_000;
const ROW_TX_MAX_WAIT_MS = 5_000;

type ParsedRow = {
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  subcategory: string;
  tagNames: string[];
  installments: NormalizedInstallments | null;
  isFixed: boolean;
  creditCardName: string;
};

type ResolvedRow = ParsedRow & { categoryId: string | null; subcategoryId: string | null; creditCardId: string | null };

export async function importTransactionsAction(rows: ImportRowPayload[]): Promise<ImportActionResult> {
  const userId = await requireUserId();

  if (rows.length === 0) {
    return { success: false, message: "Nenhuma linha válida para importar" };
  }
  if (rows.length > 1000) {
    return { success: false, message: "Limite máximo de 1000 linhas por importação" };
  }

  // Fase 0: validação total — separa linhas válidas (com tudo já normalizado) das inválidas.
  let skipped = 0;
  const parsedRows: ParsedRow[] = [];

  for (const row of rows) {
    const parsed = importRowSchema.safeParse(row);
    if (!parsed.success) {
      skipped += 1;
      continue;
    }

    const { date, description, amount, type, category, subcategory, tags, installments, isFixed, creditCard } = parsed.data;
    parsedRows.push({
      date: new Date(date),
      description,
      amount: Number(amount),
      type: type as TransactionType,
      category: (category ?? "").trim().toUpperCase(),
      subcategory: (subcategory ?? "").trim().toUpperCase(),
      tagNames: tags ? normalizeTags(tags) : [],
      installments: normalizeInstallments(installments ?? ""),
      isFixed: normalizeFixedFlag(isFixed ?? ""),
      creditCardName: (creditCard ?? "").trim(),
    });
  }

  if (parsedRows.length === 0) {
    return { success: true, imported: 0, skipped, message: `0 lançamento(s) importado(s) · ${skipped} ignorado(s) por erro` };
  }

  // Fase 0.7: última barreira de deduplicação — remove linhas que já existem na base.
  // O frontend já deve ter filtrado as duplicatas, mas esta fase cobre race conditions e bugs.
  // existingKeys é mantido fora do bloco para ser reutilizado na Fase 5 (skip de parcelas já existentes).
  let duplicatesSkipped = 0;
  let existingKeys = new Set<string>();
  {
    const dates = parsedRows.map((r) => r.date);
    let dateFrom = new Date(Math.min(...dates.map((d) => d.getTime())));
    let dateTo = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Expande o range para cobrir TODAS as parcelas (passadas e futuras) de cada linha parcelada.
    for (const row of parsedRows) {
      if (row.installments) {
        const planStart = addMonths(row.date, -(row.installments.current - 1));
        const planEnd = addMonths(row.date, row.installments.total - row.installments.current);
        if (planStart < dateFrom) dateFrom = planStart;
        if (planEnd > dateTo) dateTo = planEnd;
      }
    }
    dateFrom.setDate(dateFrom.getDate() - 1);
    dateTo.setDate(dateTo.getDate() + 1);

    const existing = await prisma.transaction.findMany({
      where: { userId, date: { gte: dateFrom, lte: dateTo } },
      select: { date: true, amount: true, type: true, description: true },
    });

    existingKeys = new Set(
      existing.map(
        (t) =>
          `${t.date.toISOString().slice(0, 10)}|${Math.round(t.amount * 100)}|${t.type}|${t.description.trim().toLowerCase()}`
      )
    );

    const deduped: ParsedRow[] = [];
    for (const row of parsedRows) {
      const dateStr = row.date.toISOString().slice(0, 10);
      let key: string;

      if (row.installments) {
        const descKey = `${row.description.trim().toLowerCase()} (${row.installments.current}/${row.installments.total})`;
        key = `${dateStr}|${Math.round(row.amount * 100)}|${row.type}|${descKey}`;
      } else {
        key = `${dateStr}|${Math.round(row.amount * 100)}|${row.type}|${row.description.trim().toLowerCase()}`;
      }

      if (existingKeys.has(key)) {
        duplicatesSkipped += 1;
      } else {
        deduped.push(row);
      }
    }

    parsedRows.length = 0;
    parsedRows.push(...deduped);
  }

  const accountId = await ensureDefaultAccountId(userId);

  // Fase 0.5: cartões de crédito (1 query).
  const BANK_NAMES: Record<string, string> = {
    btg: "btg pactual", itau: "itaú", bradesco: "bradesco",
    santander: "santander", nubank: "nubank", neon: "neon",
    inter: "inter", c6: "c6 bank",
  };
  const creditCardMap = new Map<string, string>(); // chave normalizada → id
  const hasCreditCardRows = parsedRows.some((r) => r.creditCardName);
  if (hasCreditCardRows) {
    const userCards = await prisma.creditCard.findMany({
      where: { userId },
      select: { id: true, bankCode: true, nickname: true },
    });
    for (const card of userCards) {
      const bankName = BANK_NAMES[card.bankCode] ?? card.bankCode;
      creditCardMap.set(bankName.toLowerCase(), card.id);
      creditCardMap.set(card.bankCode.toLowerCase(), card.id);
      if (card.nickname) creditCardMap.set(card.nickname.toLowerCase(), card.id);
    }
  }

  // Fase 1: categorias raiz (2 queries totais, independente do nº de linhas).
  const rootCategoryNames = parsedRows.map((row) => row.category).filter(Boolean);
  const rootCategoryMap = await batchResolveRootCategories(prisma, userId, rootCategoryNames);

  // Fase 2: sub-categorias (2 queries totais) — depende dos ids resolvidos na fase 1.
  const subcategoryItems = parsedRows
    .filter((row) => row.category && row.subcategory)
    .map((row) => ({ parentId: rootCategoryMap.get(row.category)!.id, name: row.subcategory }));
  const subcategoryMap = await batchResolveSubcategories(prisma, userId, subcategoryItems);

  // Fase 3: tags (2 queries totais).
  const allTagNames = parsedRows.flatMap((row) => row.tagNames);
  const tagMap = await batchResolveTags(prisma, userId, allTagNames);

  const resolvedRows: ResolvedRow[] = parsedRows.map((row) => {
    const categoryId = row.category ? rootCategoryMap.get(row.category)?.id ?? null : null;
    const subcategoryId =
      categoryId && row.subcategory ? subcategoryMap.get(subcategoryKey(categoryId, row.subcategory))?.id ?? null : null;
    const creditCardId = row.creditCardName
      ? (creditCardMap.get(row.creditCardName.toLowerCase()) ?? null)
      : null;
    return { ...row, categoryId, subcategoryId, creditCardId };
  });

  const installmentRows = resolvedRows.filter((row) => row.installments);
  const simpleRows = resolvedRows.filter((row) => !row.installments);

  // Fase 4: FixedExpenseTemplates (2-3 queries totais) — só para linhas simples de despesa fixa.
  const fixedItems = simpleRows
    .filter((row) => row.isFixed && row.type === "EXPENSE")
    .map((row) => ({
      description: row.description,
      categoryId: row.categoryId,
      subcategoryId: row.subcategoryId,
      amount: row.amount,
      date: row.date,
    }));
  const fixedTemplateMap = await batchResolveFixedExpenseTemplates(prisma, userId, fixedItems);

  let imported = 0;
  const tagLinks: { transactionId: string; tagId: string }[] = [];

  // Fase 5: linhas parceladas — agrupadas por (descrição base, total de parcelas) para que
  // múltiplas linhas do mesmo plano na mesma planilha criem só 1 InstallmentPlan. Mini-tx por
  // grupo (plan + parcelas de todas as linhas do grupo continuam atômicos entre si), cada grupo
  // independente dos demais — isso evita o estouro da tx global.
  const installmentGroups = new Map<string, ResolvedRow[]>();
  for (const row of installmentRows) {
    const key = `${row.description}::${row.installments!.total}`;
    const group = installmentGroups.get(key);
    if (group) group.push(row);
    else installmentGroups.set(key, [row]);
  }

  for (const groupRows of installmentGroups.values()) {
    try {
      const createdTransactions = await prisma.$transaction(
        async (tx) => {
          const firstRow = groupRows[0];
          const firstInstallments = firstRow.installments!;
          const planStartDate = addMonths(firstRow.date, -(firstInstallments.current - 1));

          const plan = await tx.installmentPlan.create({
            data: {
              userId,
              baseDescription: firstRow.description,
              totalInstallments: firstInstallments.total,
              estimatedAmount: firstRow.amount,
              startDate: planStartDate,
              categoryId: firstRow.categoryId,
              subcategoryId: firstRow.subcategoryId,
            },
          });

          const created: { id: string; tagNames: string[] }[] = [];
          for (const row of groupRows) {
            const installments = row.installments!;
            const rowStartDate = addMonths(row.date, -(installments.current - 1));
            // Cria TODAS as parcelas (1 até total), incluindo as passadas.
            // Parcelas que já existem na base são puladas para evitar duplicatas.
            for (let n = 1; n <= installments.total; n += 1) {
              const installDate = addMonths(rowStartDate, n - 1);
              const installDesc = `${row.description} (${n}/${installments.total})`;
              const dupKey = `${installDate.toISOString().slice(0, 10)}|${Math.round(row.amount * 100)}|${row.type}|${installDesc.trim().toLowerCase()}`;
              if (existingKeys.has(dupKey)) continue;

              const transaction = await tx.transaction.create({
                data: {
                  userId,
                  accountId,
                  categoryId: row.categoryId,
                  subcategoryId: row.subcategoryId,
                  type: row.type,
                  amount: row.amount,
                  date: installDate,
                  description: installDesc,
                  installmentPlanId: plan.id,
                  installmentNumber: n,
                  creditCardId: row.creditCardId,
                },
                select: { id: true },
              });
              created.push({ id: transaction.id, tagNames: row.tagNames });
            }
          }
          return created;
        },
        { timeout: ROW_TX_TIMEOUT_MS, maxWait: ROW_TX_MAX_WAIT_MS }
      );

      imported += createdTransactions.length;
      for (const created of createdTransactions) {
        for (const tagName of created.tagNames) {
          const tag = tagMap.get(tagName);
          if (tag) tagLinks.push({ transactionId: created.id, tagId: tag.id });
        }
      }
    } catch {
      skipped += groupRows.length;
    }
  }

  // Fase 6: linhas simples — 1 INSERT para N linhas.
  if (simpleRows.length > 0) {
    const simpleCreated = await prisma.transaction.createManyAndReturn({
      data: simpleRows.map((row) => ({
        userId,
        accountId,
        categoryId: row.categoryId,
        subcategoryId: row.subcategoryId,
        type: row.type,
        amount: row.amount,
        date: row.date,
        description: row.description,
        isFixed: row.isFixed,
        fixedExpenseTemplateId:
          row.isFixed && row.type === "EXPENSE" ? fixedTemplateMap.get(fixedExpenseTemplateKey(row.categoryId, row.description)) ?? null : null,
        recurrence: "NONE",
        creditCardId: row.creditCardId,
      })),
      select: { id: true },
    });
    imported += simpleCreated.length;

    simpleRows.forEach((row, index) => {
      const created = simpleCreated[index];
      for (const tagName of row.tagNames) {
        const tag = tagMap.get(tagName);
        if (tag) tagLinks.push({ transactionId: created.id, tagId: tag.id });
      }
    });
  }

  // Fase 7: tags de transação — 1 INSERT para todos os vínculos.
  if (tagLinks.length > 0) {
    await prisma.transactionTag.createMany({ data: tagLinks, skipDuplicates: true });
  }

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
    duplicatesSkipped,
    message: [
      `${imported} lançamento(s) importado(s)`,
      skipped > 0 ? `${skipped} ignorado(s) por erro` : null,
      duplicatesSkipped > 0 ? `${duplicatesSkipped} duplicata(s) bloqueada(s)` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
