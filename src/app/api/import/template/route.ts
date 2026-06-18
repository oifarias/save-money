import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Não autenticado", { status: 401 });
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Data", "Tipo", "Transação", "Categoria", "Sub-categoria", "Valor", "Tags"],
    ["10/06/2026", "despesa", "Supermercado", "Alimentação", "Mercado", "350,90", "casa,mensal"],
    ["05/06/2026", "entrada", "Salário", "Renda", "", "5000,00", ""],
    ["12/06/2026", "despesa", "Assinatura streaming", "Lazer", "Streaming", "39,90", "assinatura"],
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
      "Content-Disposition": 'attachment; filename="modelo-importacao-save-money.xlsx"',
    },
  });
}
