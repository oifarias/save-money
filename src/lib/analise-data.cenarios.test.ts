/**
 * Testes de integração (banco real) para getExplorerData — cobrem os cenários de cliente
 * do filtro de subgrupo e do drill-down automático na tela de Análise.
 *
 * Requer DATABASE_URL apontando pra um Postgres acessível (mesmo requisito dos demais
 * `.cenarios.test.ts` do projeto, ex. actions.cenarios.test.ts). getExplorerData/getExplorerForecast
 * recebem userId diretamente (sem passar por auth()), então não precisam mockar @/lib/auth.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getExplorerData } from "@/lib/analise-data";
import type { ExplorerFilters } from "@/lib/analise-data";

let userId: string;
let alimentacaoId: string;
let mercadoId: string;
let restauranteId: string;
let transporteId: string;
let combustivelId: string;
let accountId: string;

function baseFilters(overrides: Partial<ExplorerFilters> = {}): ExplorerFilters {
  return {
    categoryIds: [],
    subcategoryIds: [],
    tagIds: [],
    type: "EXPENSE",
    dateFrom: null,
    dateTo: null,
    period: "all",
    groupBy: "category",
    chartType: "bar-vertical",
    showValues: true,
    showLegend: true,
    ...overrides,
  };
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Cliente Teste Análise", email: `analise-data-cenarios-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;

  const alimentacao = await prisma.category.create({ data: { userId, name: "Alimentação", color: "#f0a500" } });
  alimentacaoId = alimentacao.id;
  mercadoId = (await prisma.category.create({ data: { userId, name: "Mercado", parentId: alimentacaoId, color: "#e8a020" } })).id;
  restauranteId = (await prisma.category.create({ data: { userId, name: "Restaurante", parentId: alimentacaoId, color: "#d09010" } })).id;

  const transporte = await prisma.category.create({ data: { userId, name: "Transporte", color: "#6366f1" } });
  transporteId = transporte.id;
  combustivelId = (await prisma.category.create({ data: { userId, name: "Combustível", parentId: transporteId, color: "#5350d0" } })).id;

  accountId = (await prisma.financialAccount.create({ data: { userId, name: "Conta", type: "wallet" } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.transaction.deleteMany({ where: { userId } });
});

async function seedTransaction(overrides: {
  amount: number;
  description: string;
  categoryId?: string;
  subcategoryId?: string;
  date?: Date;
}) {
  return prisma.transaction.create({
    data: {
      userId,
      accountId,
      type: "EXPENSE",
      amount: overrides.amount,
      description: overrides.description,
      date: overrides.date ?? new Date(),
      categoryId: overrides.categoryId ?? null,
      subcategoryId: overrides.subcategoryId ?? null,
    },
  });
}

describe("Cenário: cliente filtra 1 grupo (Alimentação) → drill-down automático por subgrupo", () => {
  it("mostra 'Mercado' e 'Restaurante' como buckets, não 'Alimentação' como bucket único", async () => {
    console.log("[cenário] cliente gastou R$400 no Mercado e R$150 no Restaurante este mês");
    await seedTransaction({ amount: 400, description: "Compras do mês", categoryId: alimentacaoId, subcategoryId: mercadoId });
    await seedTransaction({ amount: 150, description: "Jantar", categoryId: alimentacaoId, subcategoryId: restauranteId });
    // Ruído de outro grupo, que não deve aparecer
    await seedTransaction({ amount: 200, description: "Gasolina", categoryId: transporteId, subcategoryId: combustivelId });

    const result = await getExplorerData(userId, baseFilters({ categoryIds: [alimentacaoId] }));

    const labels = result.data.map((d) => d.label).sort();
    expect(labels).toEqual(["Mercado", "Restaurante"]);
    expect(result.total).toBe(550); // só o grupo filtrado entra no total
    expect(result.data.find((d) => d.label === "Mercado")?.value).toBe(400);
    expect(result.data.find((d) => d.label === "Restaurante")?.value).toBe(150);
  });
});

describe("Cenário: cliente filtra 2 grupos → volta pra visão por grupo (sem drill-down)", () => {
  it("mostra 'Alimentação' e 'Transporte' como buckets, sem detalhar subgrupos", async () => {
    console.log("[cenário] cliente compara Alimentação x Transporte no mês");
    await seedTransaction({ amount: 550, description: "Compras", categoryId: alimentacaoId, subcategoryId: mercadoId });
    await seedTransaction({ amount: 200, description: "Gasolina", categoryId: transporteId, subcategoryId: combustivelId });

    const result = await getExplorerData(userId, baseFilters({ categoryIds: [alimentacaoId, transporteId] }));

    const labels = result.data.map((d) => d.label).sort();
    expect(labels).toEqual(["Alimentação", "Transporte"]);
  });
});

describe("Cenário: cliente filtra só o subgrupo 'Mercado' (dentro de Alimentação)", () => {
  it("soma só as transações de Mercado, ignorando Restaurante do mesmo grupo", async () => {
    console.log("[cenário] cliente quer saber só quanto gastou no supermercado, não no restaurante");
    await seedTransaction({ amount: 400, description: "Compras", categoryId: alimentacaoId, subcategoryId: mercadoId });
    await seedTransaction({ amount: 150, description: "Jantar", categoryId: alimentacaoId, subcategoryId: restauranteId });

    const result = await getExplorerData(userId, baseFilters({ subcategoryIds: [mercadoId] }));

    expect(result.total).toBe(400);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.label).toBe("Mercado");
  });
});

describe("Cenário: visualização salva antes do filtro de subgrupo existir", () => {
  it("filtros sem subcategoryIds (undefined) não quebram — trata como sem filtro de subgrupo", async () => {
    console.log("[cenário] cliente abre uma análise salva há meses, com filtros no formato antigo");
    await seedTransaction({ amount: 400, description: "Compras", categoryId: alimentacaoId, subcategoryId: mercadoId });

    const legacyFilters = baseFilters({ categoryIds: [alimentacaoId] });
    // @ts-expect-error — simula o JSON legado reconstruído sem passar pelo Zod, como acontece de verdade
    delete legacyFilters.subcategoryIds;

    const result = await getExplorerData(userId, legacyFilters);
    expect(result.isEmpty).toBe(false);
  });
});
