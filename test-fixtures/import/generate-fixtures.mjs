// Script utilitário (não faz parte do build) para gerar os 3 arquivos .xlsx de fixture
// usados pelos testes de importação em lote (cenários válidos / erro / mistos).
//
// Uso: node test-fixtures/import/generate-fixtures.mjs
//
// Usa o pacote `xlsx` (mesma API do xlsx do CDN usado em produção). Se não estiver disponível
// via resolução normal de node_modules, instale localmente uma versão equivalente, ex.:
//   npm install xlsx@0.18.5 --no-save --legacy-peer-deps
// (não altera package.json/package-lock.json do projeto — a dependência real continua sendo a
// do CDN declarada em package.json).
import * as XLSX from "xlsx";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const HEADERS = ["Data", "Tipo", "Transação", "Categoria", "Sub-categoria", "Valor", "Tags", "Parcelas (x/y)", "Despesa fixa"];

function writeWorkbook(filename, rows) {
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  worksheet["!cols"] = HEADERS.map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Lançamentos");
  const fullPath = path.join(__dirname, filename);
  XLSX.writeFile(workbook, fullPath);
  console.log(`gerado: ${fullPath} (${rows.length} linha(s) de dados)`);
}

// ---------------------------------------------------------------------------
// 1) Cenários válidos — todas as linhas devem ser importadas com sucesso.
//    Categoria "Grupo" e sub-categoria "Sub-grupo" já existem para o usuário de teste
//    (ver setup em import-actions.scenarios.test.ts); "Categoria Nova XLSX" e
//    "Sub Nova XLSX" não existem e devem ser criadas pela importação.
// ---------------------------------------------------------------------------
const validRows = [
  // linha simples, sem parcela/fixa, categoria já existente
  ["10/06/2026", "despesa", "Mercado simples", "Grupo", "Sub-grupo", "150,00", "", "", ""],
  // entrada (INCOME) simples
  ["05/06/2026", "entrada", "Salário XLSX", "Grupo", "", "5000,00", "", "", ""],
  // parcelamento começando do meio "3/12"
  ["12/06/2026", "despesa", "Notebook XLSX", "Grupo", "", "250,00", "", "3/12", ""],
  // parcelamento começando em "1/4" (primeira parcela)
  ["15/01/2026", "despesa", "Sofá XLSX", "Grupo", "", "100,00", "", "1/4", ""],
  // despesa fixa marcada como "sim"
  ["01/06/2026", "despesa", "Aluguel XLSX", "Grupo", "", "1800,00", "", "", "sim"],
  // despesa fixa marcada como "true"
  ["02/06/2026", "despesa", "Internet XLSX", "Grupo", "", "120,00", "", "", "true"],
  // despesa fixa marcada como "1"
  ["03/06/2026", "despesa", "Streaming XLSX", "Grupo", "", "45,90", "", "", "1"],
  // despesa fixa marcada como "x"
  ["04/06/2026", "despesa", "Academia XLSX", "Grupo", "", "99,00", "", "", "x"],
  // categoria nova (não existe ainda para o usuário de teste)
  ["06/06/2026", "despesa", "Compra categoria nova", "Categoria Nova XLSX", "", "75,50", "", "", ""],
  // sub-categoria nova sob categoria nova
  ["07/06/2026", "despesa", "Compra subcategoria nova", "Categoria Nova XLSX", "Sub Nova XLSX", "32,00", "", "", ""],
  // categoria já existente + subcategoria já existente
  ["08/06/2026", "despesa", "Compra categoria existente", "Grupo", "Sub-grupo", "60,00", "", "", ""],
  // linha com tags
  ["09/06/2026", "despesa", "Restaurante com tags", "Grupo", "", "88,30", "lazer,comida", "", ""],
  // valor em formato BR com milhar (1.234,56) e data BR
  ["11/06/2026", "despesa", "Compra cara formato BR", "Grupo", "", "1.234,56", "", "", ""],
  // despesa simples adicional para variar o tipo EXPENSE/INCOME
  ["13/06/2026", "entrada", "Reembolso XLSX", "Grupo", "", "200,00", "reembolso", "", ""],
];

writeWorkbook("importacao-cenarios-validos.xlsx", validRows);

// ---------------------------------------------------------------------------
// 2) Cenários de erro — todas as linhas devem ser invalidadas pelo importRowSchema
//    e reportadas como `skipped`, sem nenhuma transaction criada.
// ---------------------------------------------------------------------------
const errorRows = [
  // data ausente
  ["", "despesa", "Sem data", "Grupo", "", "100,00", "", "", ""],
  // descrição ausente
  ["10/06/2026", "despesa", "", "Grupo", "", "100,00", "", "", ""],
  // valor inválido (texto)
  ["10/06/2026", "despesa", "Valor texto", "Grupo", "", "abc", "", "", ""],
  // valor inválido (negativo)
  ["10/06/2026", "despesa", "Valor negativo", "Grupo", "", "-50,00", "", "", ""],
  // valor inválido (zero)
  ["10/06/2026", "despesa", "Valor zero", "Grupo", "", "0", "", "", ""],
  // tipo inválido
  ["10/06/2026", "transferencia", "Tipo inválido", "Grupo", "", "100,00", "", "", ""],
  // parcelas em formato errado: texto
  ["10/06/2026", "despesa", "Parcelas texto", "Grupo", "", "100,00", "", "abc", ""],
  // parcelas em formato errado: current > total
  ["10/06/2026", "despesa", "Parcelas current maior que total", "Grupo", "", "100,00", "", "12/3", ""],
  // parcelas em formato errado: current = 0
  ["10/06/2026", "despesa", "Parcelas current zero", "Grupo", "", "100,00", "", "0/5", ""],
  // parcelas em formato errado: total <= 1
  ["10/06/2026", "despesa", "Parcelas total invalido", "Grupo", "", "100,00", "", "5/1", ""],
  // subcategoria sem categoria
  ["10/06/2026", "despesa", "Subcategoria sem categoria", "", "Sub-grupo", "100,00", "", "", ""],
  // tags excedendo o limite (16 tags, limite é 15)
  [
    "10/06/2026",
    "despesa",
    "Tags excedendo limite",
    "Grupo",
    "",
    "100,00",
    Array.from({ length: 16 }, (_, i) => `tag${i + 1}`).join(","),
    "",
    "",
  ],
  // descrição excedendo 140 caracteres
  ["10/06/2026", "despesa", "D".repeat(141), "Grupo", "", "100,00", "", "", ""],
];

writeWorkbook("importacao-cenarios-erro.xlsx", errorRows);

// ---------------------------------------------------------------------------
// 3) Cenários mistos — embaralha linhas válidas e linhas de erro, para validar que o
//    sistema processa as válidas e reporta corretamente as inválidas (imported/skipped).
//    Mantemos a ordem determinística (sem Math.random) para o teste poder prever
//    exatamente quantas/quais linhas são válidas vs. inválidas.
// ---------------------------------------------------------------------------
const mixedRows = [
  validRows[0], // válida: mercado simples
  errorRows[0], // erro: data ausente
  validRows[2], // válida: parcelamento 3/12
  errorRows[2], // erro: valor texto
  validRows[4], // válida: despesa fixa "sim"
  errorRows[6], // erro: parcelas texto
  validRows[8], // válida: categoria nova
  errorRows[10], // erro: subcategoria sem categoria
  validRows[3], // válida: parcelamento 1/4
  errorRows[3], // erro: valor negativo
  validRows[5], // válida: despesa fixa "true"
  errorRows[7], // erro: parcelas current > total
  validRows[11], // válida: com tags
  errorRows[11], // erro: tags excedendo limite
  validRows[12], // válida: valor BR com milhar
  errorRows[1], // erro: descrição ausente
  validRows[9], // válida: subcategoria nova
  errorRows[12], // erro: descrição muito longa
];

writeWorkbook("importacao-cenarios-mistos.xlsx", mixedRows);

console.log("\nResumo:");
console.log(`  validos: ${validRows.length} linhas (todas válidas)`);
console.log(`  erro: ${errorRows.length} linhas (todas inválidas)`);
console.log(`  mistos: ${mixedRows.length} linhas (${validRows.length >= 0 ? "9 válidas + 9 inválidas" : ""})`);
