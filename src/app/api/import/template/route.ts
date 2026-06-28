import ExcelJS from "exceljs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const BANK_NAMES: Record<string, string> = {
  btg: "BTG Pactual",
  itau: "Itaú",
  bradesco: "Bradesco",
  santander: "Santander",
  nubank: "Nubank",
  neon: "Neon",
  inter: "Inter",
  c6: "C6 Bank",
};

// SheetJS não escreve o XML de validação corretamente para o Google Sheets.
// ExcelJS gera o OOXML adequado e é amplamente compatível com Excel e Google Sheets.
//
// Estratégia de dropdown:
// - Colunas K, L, M: OCULTAS na aba "Lançamentos", contêm os dados do usuário.
// - Validações referenciam essas colunas na mesma aba → funciona em ambos os apps.
// - Referências a outra aba NÃO funcionam no Google Sheets ao importar xlsx.

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Não autenticado", { status: 401 });
  }

  const userId = session.user.id;

  const [categories, tags, creditCards] = await Promise.all([
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" }, select: { name: true } } },
    }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { bankCode: true, nickname: true },
    }),
  ]);

  const uniqueCategories = categories.map((c) => c.name);
  const subNames = categories.flatMap((c) => c.children.map((s) => s.name));
  const tagNames = tags.map((t) => t.name);
  const cardLabels = creditCards.map((c) => c.nickname ?? BANK_NAMES[c.bankCode] ?? c.bankCode);

  const workbook = new ExcelJS.Workbook();

  // ── Aba "Lançamentos" ─────────────────────────────────────────────────────
  const sheet = workbook.addWorksheet("Lançamentos");

  sheet.columns = [
    { header: "Data",               key: "A", width: 14 },
    { header: "Tipo",               key: "B", width: 12 },
    { header: "Transação",          key: "C", width: 30 },
    { header: "Categoria",          key: "D", width: 20 },
    { header: "Sub-categoria",      key: "E", width: 20 },
    { header: "Valor",              key: "F", width: 12 },
    { header: "Tags",               key: "G", width: 18 },
    { header: "Parcelas (x/y)",     key: "H", width: 16 },
    { header: "Fixa",               key: "I", width: 10 },
    { header: "Cartão de crédito",  key: "J", width: 22 },
    { header: "",                   key: "K", width: 5, hidden: true }, // lookup Categoria
    { header: "",                   key: "L", width: 5, hidden: true }, // lookup Sub-categoria
    { header: "",                   key: "M", width: 5, hidden: true }, // lookup Cartão
  ];

  // Linhas de exemplo (colunas A–J)
  const examples = [
    ["10/06/2026", "despesa",  "Supermercado",         "Alimentação",  "Mercado",  "350,90", "casa,mensal", "",      "",    ""      ],
    ["05/06/2026", "entrada",  "Salário",               "Renda",        "",         "5000,00","",            "",      "sim", ""      ],
    ["12/06/2026", "despesa",  "Notebook",              "Eletrônicos",  "",         "250,00", "",            "3/12",  "",    "Nubank"],
    ["01/06/2026", "despesa",  "Aluguel",               "Moradia",      "",         "1800,00","",            "",      "sim", ""      ],
    ["15/06/2026", "despesa",  "Jantar restaurante",    "Alimentação",  "",         "120,00", "",            "",      "",    "Nubank"],
  ];

  for (const row of examples) {
    sheet.addRow(row);
  }

  // Escreve os dados de lookup nas colunas ocultas K(11), L(12), M(13) — 1-indexed.
  const maxLookup = Math.max(uniqueCategories.length, subNames.length, cardLabels.length);
  for (let i = 0; i < maxLookup; i++) {
    const rowNum = i + 2; // linha 1 = cabeçalho; dados a partir da linha 2
    if (uniqueCategories[i]) sheet.getCell(`K${rowNum}`).value = uniqueCategories[i];
    if (subNames[i])         sheet.getCell(`L${rowNum}`).value = subNames[i];
    if (cardLabels[i])       sheet.getCell(`M${rowNum}`).value = cardLabels[i];
  }

  // ── Validações com dropdown ───────────────────────────────────────────────
  // ExcelJS 4.x tem dataValidations em runtime mas sem declaração nos tipos.
  type DV = { add(range: string, v: { type: string; allowBlank: boolean; formulae: string[]; showErrorMessage: boolean }): void };
  const dv = (sheet as unknown as { dataValidations: DV }).dataValidations;

  // Tipo: lista fixa inline (linhas 2–10000 cobrem uso prático)
  dv.add("B2:B10000", { type: "list", allowBlank: true, formulae: ['"despesa,entrada"'],  showErrorMessage: false });
  dv.add("I2:I10000", { type: "list", allowBlank: true, formulae: ['"sim,não"'],          showErrorMessage: false });

  // Categoria, Sub-categoria e Cartão → colunas ocultas K, L, M (mesma aba = compatível com Google Sheets)
  if (uniqueCategories.length > 0)
    dv.add("D2:D10000", { type: "list", allowBlank: true, formulae: [`$K$2:$K$${uniqueCategories.length + 1}`], showErrorMessage: false });

  if (subNames.length > 0)
    dv.add("E2:E10000", { type: "list", allowBlank: true, formulae: [`$L$2:$L$${subNames.length + 1}`],        showErrorMessage: false });

  if (cardLabels.length > 0)
    dv.add("J2:J10000", { type: "list", allowBlank: true, formulae: [`$M$2:$M$${cardLabels.length + 1}`],      showErrorMessage: false });

  // ── Aba "Referência" (visual — mostra os dados cadastrados organizados) ────
  const refSheet = workbook.addWorksheet("Referência");

  refSheet.columns = [
    { header: "Categoria",        key: "A", width: 22 },
    { header: "Sub-categoria",    key: "B", width: 22 },
    { header: "(Categoria pai)",  key: "C", width: 22 },
    { header: "Tag",              key: "D", width: 18 },
    { header: "Cartão de crédito", key: "E", width: 24 },
  ];

  const subEntries = categories.flatMap((c) =>
    c.children.map((s) => ({ sub: s.name, parent: c.name }))
  );
  const maxRef = Math.max(uniqueCategories.length, subEntries.length, tagNames.length, cardLabels.length, 1);

  for (let i = 0; i < maxRef; i++) {
    refSheet.addRow([
      uniqueCategories[i] ?? "",
      subEntries[i]?.sub ?? "",
      subEntries[i]?.parent ?? "",
      tagNames[i] ?? "",
      cardLabels[i] ?? "",
    ]);
  }

  // ── Estilo do cabeçalho ───────────────────────────────────────────────────
  const HEADER_BG   = "FF1A9E6F"; // verde primário da aplicação (#1a9e6f) em ARGB
  const HEADER_TEXT = "FFFFFFFF"; // branco

  function styleHeader(ws: ExcelJS.Worksheet, colCount: number) {
    const row = ws.getRow(1);
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, color: { argb: HEADER_TEXT } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
    }
  }

  styleHeader(sheet, 10);    // A–J (colunas visíveis da aba Lançamentos)
  styleHeader(refSheet, 5);  // A–E da aba Referência

  // ── Gera o buffer e retorna ────────────────────────────────────────────────
  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-importacao-save-money.xlsx"',
    },
  });
}
