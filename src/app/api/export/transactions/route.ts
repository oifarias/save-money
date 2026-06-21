import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { buildTransactionWhere } from "@/lib/transaction-filters";

function formatDateBR(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Não autenticado", { status: 401 });
  }
  const userId = session.user.id;

  const url = new URL(request.url);
  const rawSearchParams = Object.fromEntries(url.searchParams);
  const filters = parseTransactionFilters(rawSearchParams);
  const where = await buildTransactionWhere(userId, filters);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const rows = transactions.map((transaction) => [
    formatDateBR(transaction.date),
    transaction.type === "EXPENSE" ? "despesa" : "entrada",
    transaction.description,
    transaction.category?.name ?? "",
    transaction.subcategory?.name ?? "",
    transaction.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    transaction.tags.map((t) => t.tag.name).join(","),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Data", "Tipo", "Transação", "Categoria", "Sub-categoria", "Valor", "Tags"],
    ...rows,
  ]);
  worksheet["!cols"] = [
    { wch: 14 },
    { wch: 12 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Lançamentos");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lancamentos-save-money.xlsx"',
    },
  });
}
