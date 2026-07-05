import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type CheckDuplicatesRequestRow = {
  date: string;
  amount: number;
  type: string;
  description: string;
  installments?: string;
};

type CheckDuplicatesRequest = {
  rows: CheckDuplicatesRequestRow[];
};

export type ExistingTransactionDetail = {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "EXPENSE" | "INCOME";
  category: { name: string; color: string; icon: string } | null;
  subcategory: { name: string } | null;
  tags: string[];
  installmentNumber: number | null;
  installmentTotal: number | null;
};

export type DuplicateMatch = {
  importedRowIndex: number;
  importedDescription: string;
  importedDate: string;
  importedAmount: number;
  importedType: "EXPENSE" | "INCOME";
  importedInstallments: string | null;
  existing: ExistingTransactionDetail;
};

export type CheckDuplicatesResponse = {
  duplicateIndices: number[];
  matches: DuplicateMatch[];
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await request.json()) as CheckDuplicatesRequest;

  if (!body.rows?.length) {
    return NextResponse.json({ duplicateIndices: [], matches: [] } satisfies CheckDuplicatesResponse);
  }
  if (body.rows.length > 1000) {
    return NextResponse.json({ error: "Limite excedido" }, { status: 400 });
  }

  type CheckKey = {
    date: string;
    amountCents: number;
    type: string;
    descriptionNorm: string;
    originalDescription: string;
    originalDate: string;
    originalAmount: number;
    originalType: "EXPENSE" | "INCOME";
    originalInstallments: string | null;
  };

  const checkKeys: CheckKey[] = body.rows.map((row) => {
    const installments = row.installments ?? null;
    let descriptionNorm = row.description.trim().toLowerCase();

    if (installments) {
      const parts = installments.split("/");
      const current = parseInt(parts[0] ?? "0", 10);
      const total = parseInt(parts[1] ?? "0", 10);
      if (!isNaN(current) && !isNaN(total)) {
        descriptionNorm = `${descriptionNorm} (${current}/${total})`;
      }
    }

    return {
      date: row.date,
      amountCents: Math.round(row.amount * 100),
      type: row.type,
      descriptionNorm,
      originalDescription: row.description,
      originalDate: row.date,
      originalAmount: row.amount,
      originalType: (row.type === "INCOME" ? "INCOME" : "EXPENSE") as "EXPENSE" | "INCOME",
      originalInstallments: installments,
    };
  });

  const sortedDates = checkKeys.map((k) => k.date).sort();
  const dateFrom = new Date(sortedDates[0]);
  const dateTo = new Date(sortedDates[sortedDates.length - 1]);
  dateFrom.setDate(dateFrom.getDate() - 1);
  dateTo.setDate(dateTo.getDate() + 1);

  const existingTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      date: { gte: dateFrom, lte: dateTo },
    },
    select: {
      id: true,
      date: true,
      amount: true,
      type: true,
      description: true,
      category: { select: { name: true, color: true, icon: true } },
      subcategory: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
      installmentNumber: true,
      installmentPlan: { select: { totalInstallments: true } },
    },
  });

  const existingByKey = new Map<string, typeof existingTransactions[number]>();
  for (const t of existingTransactions) {
    const key = `${t.date.toISOString().slice(0, 10)}|${Math.round(t.amount * 100)}|${t.type}|${t.description.trim().toLowerCase()}`;
    existingByKey.set(key, t);
  }

  const duplicateIndices: number[] = [];
  const matches: DuplicateMatch[] = [];

  checkKeys.forEach((key, index) => {
    const lookup = `${key.date}|${key.amountCents}|${key.type}|${key.descriptionNorm}`;
    const found = existingByKey.get(lookup);
    if (!found) return;

    duplicateIndices.push(index);
    matches.push({
      importedRowIndex: index,
      importedDescription: key.originalDescription,
      importedDate: key.originalDate,
      importedAmount: key.originalAmount,
      importedType: key.originalType,
      importedInstallments: key.originalInstallments,
      existing: {
        id: found.id,
        date: found.date.toISOString().slice(0, 10),
        description: found.description,
        amount: found.amount,
        type: found.type as "EXPENSE" | "INCOME",
        category: found.category ?? null,
        subcategory: found.subcategory ?? null,
        tags: found.tags.map((t) => t.tag.name),
        installmentNumber: found.installmentNumber,
        installmentTotal: found.installmentPlan?.totalInstallments ?? null,
      },
    });
  });

  return NextResponse.json({ duplicateIndices, matches } satisfies CheckDuplicatesResponse);
}
