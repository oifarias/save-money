import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Não autenticado", { status: 401 });
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    ["Data", "Descrição", "Valor", "Tipo"],
    ["10/06/2026", "Supermercado", "350,90", "despesa"],
    ["05/06/2026", "Salário", "5000,00", "entrada"],
    ["12/06/2026", "Assinatura streaming", "39,90", "despesa"],
  ]);
  worksheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 12 }, { wch: 14 }];

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
