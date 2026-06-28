import { describe, expect, it } from "vitest";
import { buildMappedRows, guessColumnMapping, summarizeMappedRows, NONE_COLUMN } from "@/lib/import-helpers";
import { readFixtureSheet, identityMapping } from "../../tests/import/load-fixture";

describe("import-helpers (regras de frontend) — guessColumnMapping nos 3 fixtures .xlsx", () => {
  it("planilha de cenários válidos: todas as colunas são reconhecidas automaticamente pelos headers do modelo", () => {
    console.log("[cenário] regras de frontend — guessColumnMapping reconhece todas as colunas da planilha de cenários válidos");

    // Arrange
    const sheet = readFixtureSheet("validos");

    // Act
    const mapping = guessColumnMapping(sheet.headers);

    // Assert
    expect(mapping.date).toBe("Data");
    expect(mapping.description).toBe("Transação");
    expect(mapping.amount).toBe("Valor");
    expect(mapping.type).toBe("Tipo");
    expect(mapping.category).toBe("Categoria");
    expect(mapping.subcategory).toBe("Sub-categoria");
    expect(mapping.tags).toBe("Tags");
    expect(mapping.installments).toBe("Parcelas (x/y)");
    // Fixtures legados usavam "Despesa fixa" — ainda reconhecido via COLUMN_GUESSES para retrocompatibilidade.
    // O novo template usa "Fixa", mas ambos os formatos são aceitos.
    expect(mapping.isFixed).toBe("Despesa fixa");
    // creditCard é opcional e os fixtures foram criados antes desta coluna existir; por isso pode ser NONE_COLUMN.
    const mappingWithoutCreditCard = Object.entries(mapping)
      .filter(([key]) => key !== "creditCard")
      .map(([, value]) => value);
    expect(mappingWithoutCreditCard).not.toContain(NONE_COLUMN);
  });

  it("planilha de cenários de erro e mista também têm o mapeamento totalmente reconhecido (mesmos headers do modelo)", () => {
    console.log("[cenário] regras de frontend — guessColumnMapping reconhece colunas também nas planilhas de erro e mista");

    // Arrange
    const erroSheet = readFixtureSheet("erro");
    const mistosSheet = readFixtureSheet("mistos");

    // Act
    const erroMapping = guessColumnMapping(erroSheet.headers);
    const mistosMapping = guessColumnMapping(mistosSheet.headers);

    // Assert — creditCard é opcional e os fixtures legados não têm essa coluna
    const withoutCreditCard = (m: Record<string, string>) =>
      Object.entries(m).filter(([k]) => k !== "creditCard").map(([, v]) => v);
    expect(withoutCreditCard(erroMapping)).not.toContain(NONE_COLUMN);
    expect(withoutCreditCard(mistosMapping)).not.toContain(NONE_COLUMN);
  });
});

describe("import-helpers (regras de frontend) — buildMappedRows nos 3 fixtures .xlsx", () => {
  it("planilha de cenários válidos: nenhuma linha tem erro de validação no preview do wizard", () => {
    console.log("[cenário] regras de frontend — preview do wizard não marca nenhuma linha como erro na planilha de cenários válidos");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();

    // Act
    const rows = buildMappedRows(sheet, mapping);

    // Assert
    expect(rows).toHaveLength(14);
    expect(rows.filter((row) => row.error)).toEqual([]);
  });

  it("planilha de cenários de erro: todas as linhas têm uma mensagem de erro associada no preview do wizard", () => {
    console.log("[cenário] regras de frontend — preview do wizard marca todas as linhas com erro na planilha de cenários de erro (exceto o bug conhecido de valor negativo)");

    // Arrange
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();

    // Act
    const rows = buildMappedRows(sheet, mapping);

    // Assert
    expect(rows).toHaveLength(13);
    // Todas as linhas DEVERIAM ter erro; "Valor negativo" é a exceção conhecida (ver teste de
    // regressão dedicado "BUG conhecido: valor negativo...") e por isso é excluída aqui.
    const rowsExceptKnownBug = rows.filter((row) => row.description !== "Valor negativo");
    expect(rowsExceptKnownBug).toHaveLength(12);
    for (const row of rowsExceptKnownBug) {
      expect(row.error).toBeTruthy();
    }
  });

  it("planilha de cenários de erro: cada tipo de erro esperado aparece com a mensagem correta", () => {
    console.log("[cenário] regras de frontend — mensagens de erro específicas (data ausente, valor inválido, parcelas, etc.) aparecem corretamente");

    // Arrange
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();

    // Act
    const rows = buildMappedRows(sheet, mapping);
    const errorByDescription = new Map(rows.map((row) => [row.description, row.error]));

    // Assert
    expect(errorByDescription.get("")).toBeTruthy(); // linha sem data (descrição também vazia nessa linha)
    // "Valor texto": normalizeAmount("abc") não consegue converter e devolve "" -> cai na regra de
    // "Valor ausente" (min(1)) antes mesmo de chegar no refine que produziria "Valor inválido".
    expect(errorByDescription.get("Valor texto")).toBe("Valor ausente");
    expect(errorByDescription.get("Valor zero")).toBe("Valor inválido");
    expect(errorByDescription.get("Tipo inválido")).toBe("Tipo inválido (use despesa ou entrada)");
    expect(errorByDescription.get("Parcelas texto")).toBe("Formato de parcelas inválido (use x/y, ex: 3/12)");
    expect(errorByDescription.get("Parcelas current maior que total")).toBe("Formato de parcelas inválido (use x/y, ex: 3/12)");
    expect(errorByDescription.get("Parcelas current zero")).toBe("Formato de parcelas inválido (use x/y, ex: 3/12)");
    expect(errorByDescription.get("Parcelas total invalido")).toBe("Formato de parcelas inválido (use x/y, ex: 3/12)");
    expect(errorByDescription.get("Subcategoria sem categoria")).toBe("Sub-categoria requer uma categoria");
    expect(errorByDescription.get("Tags excedendo limite")).toBe("Máximo de 15 tags por lançamento");
    expect(errorByDescription.get("D".repeat(141))).toBe("Descrição muito longa");
  });

  it("planilha mista: separa corretamente 10 linhas válidas de 8 linhas com erro no preview do wizard", () => {
    console.log("[cenário] regras de frontend — preview do wizard separa corretamente válidas/erros na planilha mista");

    // Arrange
    const sheet = readFixtureSheet("mistos");
    const mapping = identityMapping();

    // Act
    const rows = buildMappedRows(sheet, mapping);
    const valid = rows.filter((row) => !row.error);
    const invalid = rows.filter((row) => row.error);

    // Assert
    expect(rows).toHaveLength(18);
    // 9 linhas válidas do fixture + 1 ("Valor negativo") que deveria ser inválida mas não é —
    // ver teste de regressão dedicado abaixo ("BUG conhecido: valor negativo...").
    expect(valid).toHaveLength(10);
    expect(invalid).toHaveLength(8);
  });

  it("BUG conhecido: valor negativo com tipo já preenchido (ex.: 'despesa') não é rejeitado pelo preview do wizard", () => {
    console.log(
      "[cenário] regras de frontend — REGRESSÃO CONHECIDA: 'Valor negativo' (despesa, -50,00) passa validação sem erro porque buildMappedRows despe o sinal de negativo do valor incondicionalmente, mesmo quando o tipo já veio preenchido pela coluna 'Tipo'"
    );

    // Arrange
    // A lógica em `buildMappedRows` (import-helpers.ts) só deveria inferir o tipo a partir do
    // sinal do valor quando a coluna "Tipo" NÃO foi informada/reconhecida. Hoje ela sempre
    // remove o sinal de "-" do valor, mesmo quando o tipo já veio preenchido explicitamente
    // (ex.: "despesa" + "-50,00"), silenciosamente aceitando uma linha que deveria ser inválida
    // (valor negativo é um erro de dado, não uma forma alternativa de indicar despesa).
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();

    // Act
    const rows = buildMappedRows(sheet, mapping);
    const negativeRow = rows.find((row) => row.description === "Valor negativo");

    // Assert — comportamento ATUAL (não o esperado): a linha é tratada como válida.
    // Se esse teste passar a falhar após uma correção em buildMappedRows, é sinal de que o bug
    // foi corrigido — nesse caso, atualize esta asserção para `expect(negativeRow?.error).toBeTruthy()`.
    expect(negativeRow).toBeDefined();
    expect(negativeRow?.amount).toBe("50");
    expect(negativeRow?.type).toBe("EXPENSE");
    expect(negativeRow?.error).toBeUndefined();
  });
});

describe("import-helpers (regras de frontend) — summarizeMappedRows nos 3 fixtures .xlsx", () => {
  it("planilha de cenários válidos: resumo mostra contagem de categorias novas/existentes e parcelas futuras corretas", () => {
    console.log("[cenário] regras de frontend — resumo da prévia (summarizeMappedRows) calcula categorias novas/existentes e parcelas futuras na planilha válida");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const rows = buildMappedRows(sheet, mapping);
    const existingCategories = [{ name: "Grupo", parentName: null }, { name: "Sub-grupo", parentName: "Grupo" }];

    // Act
    const summary = summarizeMappedRows(rows, existingCategories);

    // Assert
    expect(summary.totalRows).toBe(14);
    expect(summary.validCount).toBe(14);
    expect(summary.invalidCount).toBe(0);
    // categorias usadas nas linhas válidas: "Grupo" (existente) e "Categoria Nova XLSX" (nova)
    expect(summary.existingCategoriesCount).toBe(1);
    expect(summary.newCategoriesCount).toBe(1);
    // sub-categorias usadas: "Sub-grupo" sob "Grupo" (existente) e "Sub Nova XLSX" sob "Categoria Nova XLSX" (nova)
    expect(summary.existingSubcategoriesCount).toBe(1);
    expect(summary.newSubcategoriesCount).toBe(1);
    // parcelas futuras: "3/12" (12-3=9) + "1/4" (4-1=3) = 12
    expect(summary.futureInstallmentsCount).toBe(12);
    expect(summary.tagsCount).toBe(3); // "lazer", "comida" (Restaurante com tags) e "reembolso" (Reembolso XLSX)
  });

  it("planilha de cenários de erro: resumo mostra validCount=1 (bug conhecido de valor negativo) e o restante invalidCount", () => {
    console.log(
      "[cenário] regras de frontend — resumo da prévia na planilha 100% de erro: 12 linhas inválidas + 1 'falsa válida' (bug do valor negativo documentado acima)"
    );

    // Arrange
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();
    const rows = buildMappedRows(sheet, mapping);

    // Act
    const summary = summarizeMappedRows(rows);

    // Assert
    expect(summary.totalRows).toBe(13);
    // Em teoria todas as 13 linhas deveriam ser inválidas; hoje "Valor negativo" escapa da
    // validação (ver teste de regressão dedicado), por isso validCount é 1 e não 0.
    expect(summary.validCount).toBe(1);
    expect(summary.invalidCount).toBe(12);
    expect(summary.totalIncome).toBe(0);
    // "Valor negativo" entra como despesa de 50 (sinal já removido por buildMappedRows).
    expect(summary.totalExpense).toBe(50);
  });

  it("planilha mista: resumo soma validCount + invalidCount = totalRows e calcula saldo só com as linhas válidas", () => {
    console.log("[cenário] regras de frontend — resumo da prévia na planilha mista soma válidas+erros = total e ignora valores das linhas inválidas no saldo");

    // Arrange
    const sheet = readFixtureSheet("mistos");
    const mapping = identityMapping();
    const rows = buildMappedRows(sheet, mapping);

    // Act
    const summary = summarizeMappedRows(rows);

    // Assert
    expect(summary.totalRows).toBe(18);
    expect(summary.validCount + summary.invalidCount).toBe(18);
    // 9 linhas válidas do fixture + 1 "falsa válida" (bug do valor negativo, ver teste dedicado).
    expect(summary.validCount).toBe(10);
    expect(summary.invalidCount).toBe(8);
    // só linhas válidas entram nos totais financeiros; nenhuma linha de erro deveria contaminar o saldo
    expect(Number.isFinite(summary.balance)).toBe(true);
  });
});
