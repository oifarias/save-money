import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { buildMappedRows } from "@/lib/import-helpers";
import { readFixtureSheet, identityMapping } from "../../../../test-fixtures/import/load-fixture";

const sessionUserId = { current: "" };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionUserId.current ? { user: { id: sessionUserId.current } } : null)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { importTransactionsAction, type ImportRowPayload } from "./import-actions";

let userId: string;
let categoryId: string;
let subcategoryId: string;

async function createUserWithCategory(emailSuffix: string) {
  const user = await prisma.user.create({
    data: { name: "Teste cenários", email: `import-scenarios-test-${emailSuffix}@example.com`, passwordHash: "x" },
  });
  // Mesmos nomes usados nos fixtures .xlsx ("Grupo" / "Sub-grupo") para representar
  // "categoria/sub-categoria já existente" nos cenários válidos e mistos.
  const category = await prisma.category.create({ data: { userId: user.id, name: "Grupo" } });
  const subcategory = await prisma.category.create({ data: { userId: user.id, name: "Sub-grupo", parentId: category.id } });
  await prisma.account.create({ data: { userId: user.id, name: "Conta", type: "wallet" } });
  return { user, category, subcategory };
}

/** Converte as linhas já mapeadas/validadas do wizard (`buildMappedRows`) no payload aceito pela Server Action. */
function toPayload(rows: ReturnType<typeof buildMappedRows>): ImportRowPayload[] {
  return rows
    .filter((row) => !row.error)
    .map(({ date, description, amount, type, category, subcategory, tags, installments, isFixed }) => ({
      date,
      description,
      amount,
      type,
      category,
      subcategory,
      tags,
      installments,
      isFixed,
    }));
}

beforeAll(async () => {
  const main = await createUserWithCategory(`${Date.now()}-main`);
  userId = main.user.id;
  categoryId = main.category.id;
  subcategoryId = main.subcategory.id;
});

afterAll(async () => {
  await prisma.category.deleteMany({ where: { userId, name: { contains: "Nova XLSX" } } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  sessionUserId.current = userId;
  // limpa estado entre testes para não vazar transações/planos/templates/categorias novas de um `it` para outro
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId, name: { contains: "Nova XLSX" } } });
});

describe("importação em lote via planilha .xlsx — cenários válidos (importacao-cenarios-validos.xlsx)", () => {
  it("todas as linhas da planilha de cenários válidos são parseadas sem erro pelo wizard (buildMappedRows)", () => {
    console.log("[cenário] planilha de cenários válidos — nenhuma linha deve ter erro de validação no mapeamento client-side");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();

    // Act
    const mappedRows = buildMappedRows(sheet, mapping);

    // Assert
    expect(mappedRows).toHaveLength(14);
    const withError = mappedRows.filter((row) => row.error);
    expect(withError).toEqual([]);
  });

  it("importTransactionsAction importa todas as linhas válidas, somando as parcelas futuras geradas, sem nenhum skip", async () => {
    console.log("[cenário] planilha de cenários válidos — todas as linhas são importadas (imported = total + parcelas futuras, skipped = 0)");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const mappedRows = buildMappedRows(sheet, mapping);
    const payload = toPayload(mappedRows);
    expect(payload).toHaveLength(14); // pré-condição: nenhuma linha foi filtrada por erro

    // Act
    const result = await importTransactionsAction(payload);

    // Assert
    // 14 linhas "simples" (1 transaction cada) + parcelas futuras geradas pelas 2 linhas com installments:
    // "3/12" gera parcelas 3..12 (10 transactions) e "1/4" gera parcelas 1..4 (4 transactions).
    // As outras 12 linhas geram 1 transaction cada => 12 + 10 + 4 = 26.
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(0);
    expect(result.imported).toBe(26);

    const allCreated = await prisma.transaction.findMany({ where: { userId } });
    expect(allCreated).toHaveLength(26);
  });

  it("linha de parcelamento '3/12' da planilha gera plano com 10 transactions (parcelas 3 a 12)", async () => {
    console.log("[cenário] planilha de cenários válidos — parcelamento '3/12' (Notebook XLSX) materializa parcelas 3..12");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const created = await prisma.transaction.findMany({
      where: { userId, installmentPlan: { baseDescription: "Notebook XLSX" } },
      orderBy: { installmentNumber: "asc" },
    });
    expect(created).toHaveLength(10);
    expect(created.map((t) => t.installmentNumber)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("linhas de despesa fixa marcadas com 'sim'/'true'/'1'/'x' criam FixedExpenseTemplate ativo e isFixed=true", async () => {
    console.log("[cenário] planilha de cenários válidos — variações de despesa fixa (sim/true/1/x) marcam isFixed e criam template");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));
    const fixedDescriptions = ["Aluguel XLSX", "Internet XLSX", "Streaming XLSX", "Academia XLSX"];

    // Act
    await importTransactionsAction(payload);

    // Assert
    const created = await prisma.transaction.findMany({
      where: { userId, description: { in: fixedDescriptions } },
    });
    expect(created).toHaveLength(4);
    for (const transaction of created) {
      expect(transaction.isFixed).toBe(true);
      expect(transaction.fixedExpenseTemplateId).not.toBeNull();
    }
  });

  it("linha com categoria inexistente ('Categoria Nova XLSX') cria a categoria automaticamente", async () => {
    console.log("[cenário] planilha de cenários válidos — categoria nova é criada automaticamente durante a importação");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));
    const beforeCategory = await prisma.category.findFirst({ where: { userId, name: "Categoria Nova XLSX" } });
    expect(beforeCategory).toBeNull(); // pré-condição: categoria ainda não existe

    // Act
    await importTransactionsAction(payload);

    // Assert
    const afterCategory = await prisma.category.findFirst({ where: { userId, name: "Categoria Nova XLSX" } });
    expect(afterCategory).not.toBeNull();
    expect(afterCategory!.parentId).toBeNull();

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Compra categoria nova" } });
    expect(transaction?.categoryId).toBe(afterCategory!.id);
  });

  it("linha com categoria já existente ('Grupo') reaproveita a categoria sem duplicar", async () => {
    console.log("[cenário] planilha de cenários válidos — categoria já existente ('Grupo') é reaproveitada, sem duplicação");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const categories = await prisma.category.findMany({ where: { userId, name: "Grupo", parentId: null } });
    expect(categories).toHaveLength(1);
    expect(categories[0].id).toBe(categoryId);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Compra categoria existente" } });
    expect(transaction?.categoryId).toBe(categoryId);
    expect(transaction?.subcategoryId).toBe(subcategoryId);
  });

  it("linha com subcategoria nova ('Sub Nova XLSX') sob categoria nova cria ambas vinculadas corretamente", async () => {
    console.log("[cenário] planilha de cenários válidos — subcategoria nova sob categoria nova é criada com parentId correto");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const parentCategory = await prisma.category.findFirst({ where: { userId, name: "Categoria Nova XLSX" } });
    const subcategory = await prisma.category.findFirst({ where: { userId, name: "Sub Nova XLSX" } });
    expect(parentCategory).not.toBeNull();
    expect(subcategory).not.toBeNull();
    expect(subcategory!.parentId).toBe(parentCategory!.id);

    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Compra subcategoria nova" } });
    expect(transaction?.categoryId).toBe(parentCategory!.id);
    expect(transaction?.subcategoryId).toBe(subcategory!.id);
  });

  it("linha com tags ('lazer,comida') cria as tags e vincula à transaction", async () => {
    console.log("[cenário] planilha de cenários válidos — tags da linha 'Restaurante com tags' são criadas e vinculadas");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const transaction = await prisma.transaction.findFirst({
      where: { userId, description: "Restaurante com tags" },
      include: { tags: { include: { tag: true } } },
    });
    expect(transaction).not.toBeNull();
    const tagNames = transaction!.tags.map((t) => t.tag.name).sort();
    expect(tagNames).toEqual(["comida", "lazer"]);
  });

  it("linha com valor em formato BR com milhar ('1.234,56') é convertida para 1234.56", async () => {
    console.log("[cenário] planilha de cenários válidos — valor BR com separador de milhar é normalizado corretamente");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const transaction = await prisma.transaction.findFirst({ where: { userId, description: "Compra cara formato BR" } });
    expect(transaction).not.toBeNull();
    expect(transaction!.amount).toBe(1234.56);
  });

  it("linha de entrada (INCOME) e linha de despesa (EXPENSE) são gravadas com o tipo correto", async () => {
    console.log("[cenário] planilha de cenários válidos — tipos INCOME e EXPENSE são preservados corretamente");

    // Arrange
    const sheet = readFixtureSheet("validos");
    const mapping = identityMapping();
    const payload = toPayload(buildMappedRows(sheet, mapping));

    // Act
    await importTransactionsAction(payload);

    // Assert
    const income = await prisma.transaction.findFirst({ where: { userId, description: "Salário XLSX" } });
    const expense = await prisma.transaction.findFirst({ where: { userId, description: "Mercado simples" } });
    expect(income?.type).toBe("INCOME");
    expect(expense?.type).toBe("EXPENSE");
  });
});

describe("importação em lote via planilha .xlsx — cenários de erro (importacao-cenarios-erro.xlsx)", () => {
  it("12 das 13 linhas da planilha de erro são marcadas com erro pelo wizard (buildMappedRows)", () => {
    console.log(
      "[cenário] planilha de cenários de erro — 12 linhas devem ter erro de validação no mapeamento client-side; 'Valor negativo' é o bug conhecido (ver import-helpers.scenarios.test.ts)"
    );

    // Arrange
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();

    // Act
    const mappedRows = buildMappedRows(sheet, mapping);
    const rowsExceptKnownBug = mappedRows.filter((row) => row.description !== "Valor negativo");

    // Assert
    expect(mappedRows).toHaveLength(13);
    expect(rowsExceptKnownBug).toHaveLength(12);
    expect(rowsExceptKnownBug.every((row) => Boolean(row.error))).toBe(true);
  });

  it("importTransactionsAction importa só a linha 'falsa válida' (bug do valor negativo) e ignora as outras 12", async () => {
    console.log(
      "[cenário] planilha de cenários de erro — quase nenhuma linha válida sobra para enviar à Server Action; só 'Valor negativo' (bug conhecido) é enviada"
    );

    // Arrange
    const sheet = readFixtureSheet("erro");
    const mapping = identityMapping();
    const mappedRows = buildMappedRows(sheet, mapping);
    const payload = toPayload(mappedRows);
    // pré-condição: o wizard enviaria só "Valor negativo" (bug conhecido), as outras 12 têm erro.
    expect(payload).toHaveLength(1);
    expect(payload[0].description).toBe("Valor negativo");

    // Server Action recusa lote vazio; simulamos o envio de todas as linhas brutas já normalizadas
    // pelo wizard (sem filtrar por `error`) para confirmar que o schema do backend também invalida cada uma.
    const fullPayload: ImportRowPayload[] = mappedRows.map(
      ({ date, description, amount, type, category, subcategory, tags, installments, isFixed }) => ({
        date,
        description,
        amount,
        type,
        category,
        subcategory,
        tags,
        installments,
        isFixed,
      })
    );

    // Act
    const result = await importTransactionsAction(fullPayload);

    // Assert
    // "Valor negativo" também escapa da validação do backend (recebe amount="50" já sem sinal,
    // já normalizado pelo wizard) — mesmo bug de raiz, ver nota acima e em import-helpers.scenarios.test.ts.
    expect(result.success).toBe(true);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(12);

    const created = await prisma.transaction.findMany({ where: { userId } });
    expect(created).toHaveLength(1);
    expect(created[0].description).toBe("Valor negativo");
    expect(created[0].amount).toBe(50);
  });
});

describe("importação em lote via planilha .xlsx — cenários mistos (importacao-cenarios-mistos.xlsx)", () => {
  it("o wizard separa corretamente as 10 linhas válidas das 8 linhas com erro (buildMappedRows)", () => {
    console.log(
      "[cenário] planilha mista — buildMappedRows separa 10 linhas válidas de 8 linhas inválidas (inclui o bug conhecido de valor negativo não rejeitado, ver import-helpers.scenarios.test.ts)"
    );

    // Arrange
    const sheet = readFixtureSheet("mistos");
    const mapping = identityMapping();

    // Act
    const mappedRows = buildMappedRows(sheet, mapping);
    const valid = mappedRows.filter((row) => !row.error);
    const invalid = mappedRows.filter((row) => row.error);

    // Assert
    expect(mappedRows).toHaveLength(18);
    // 9 linhas válidas do fixture + 1 "falsa válida" ("Valor negativo") — ver bug documentado
    // em src/lib/import-helpers.scenarios.test.ts ("BUG conhecido: valor negativo...").
    expect(valid).toHaveLength(10);
    expect(invalid).toHaveLength(8);
  });

  it("importTransactionsAction importa só as linhas válidas do lote misto, e imported/skipped refletem a planilha completa", async () => {
    console.log("[cenário] planilha mista — Server Action importa as válidas e reporta skipped para as que falharam no schema do backend");

    // Arrange
    const sheet = readFixtureSheet("mistos");
    const mapping = identityMapping();
    const mappedRows = buildMappedRows(sheet, mapping);
    const validDescriptions = mappedRows.filter((row) => !row.error).map((row) => row.description);

    // Envia TODAS as linhas (válidas + inválidas) ao backend, simulando um caller que não
    // filtrou no client — o schema Zod do backend deve invalidar as mesmas 8 linhas de erro
    // (o backend recebe "Valor negativo" já como "50" sem sinal, então também não a rejeita —
    // mesmo bug de raiz documentado em import-helpers.scenarios.test.ts).
    const fullPayload: ImportRowPayload[] = mappedRows.map(
      ({ date, description, amount, type, category, subcategory, tags, installments, isFixed }) => ({
        date,
        description,
        amount,
        type,
        category,
        subcategory,
        tags,
        installments,
        isFixed,
      })
    );

    // Act
    const result = await importTransactionsAction(fullPayload);

    // Assert
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(8);
    // As 10 linhas "válidas" do lote misto não têm installments, logo 1 transaction por linha.
    expect(result.imported).toBe(10);
    expect(result.imported! + result.skipped!).toBe(18);

    const created = await prisma.transaction.findMany({ where: { userId } });
    expect(created).toHaveLength(10);
    const createdDescriptions = created.map((t) => t.description).sort();
    expect(createdDescriptions).toEqual([...validDescriptions].sort());
  });

  it("nenhuma transaction é criada para as descrições das linhas de erro do lote misto", async () => {
    console.log("[cenário] planilha mista — descrições das linhas inválidas não geram nenhuma transaction no banco");

    // Arrange
    const sheet = readFixtureSheet("mistos");
    const mapping = identityMapping();
    const mappedRows = buildMappedRows(sheet, mapping);
    const invalidDescriptions = mappedRows.filter((row) => row.error).map((row) => row.description).filter(Boolean);
    const fullPayload: ImportRowPayload[] = mappedRows.map(
      ({ date, description, amount, type, category, subcategory, tags, installments, isFixed }) => ({
        date,
        description,
        amount,
        type,
        category,
        subcategory,
        tags,
        installments,
        isFixed,
      })
    );

    // Act
    await importTransactionsAction(fullPayload);

    // Assert
    const createdWithInvalidDescriptions = await prisma.transaction.findMany({
      where: { userId, description: { in: invalidDescriptions } },
    });
    expect(createdWithInvalidDescriptions).toHaveLength(0);
  });
});
