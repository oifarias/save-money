import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { batchResolveSubcategories, subcategoryKey } from "@/lib/category-resolver";

let userId: string;
let parentA: string;
let parentB: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `batch-resolve-subcategories-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.category.deleteMany({ where: { userId } });
  const a = await prisma.category.create({ data: { userId, name: "Alimentação" } });
  const b = await prisma.category.create({ data: { userId, name: "Transporte" } });
  parentA = a.id;
  parentB = b.id;
});

describe("batchResolveSubcategories", () => {
  it("cria 1 sub-categoria nova sob o pai informado", async () => {
    const map = await batchResolveSubcategories(prisma, userId, [{ parentId: parentA, name: "Restaurante" }]);

    const created = await prisma.category.findMany({ where: { userId, parentId: parentA } });
    expect(created).toHaveLength(1);
    expect(map.get(subcategoryKey(parentA, "Restaurante"))?.id).toBe(created[0].id);
  });

  it("reaproveita 1 sub-categoria já existente sem duplicar", async () => {
    const existing = await prisma.category.create({ data: { userId, name: "Mercado", parentId: parentA } });

    const map = await batchResolveSubcategories(prisma, userId, [{ parentId: parentA, name: "Mercado" }]);

    const all = await prisma.category.findMany({ where: { userId, parentId: parentA } });
    expect(all).toHaveLength(1);
    expect(map.get(subcategoryKey(parentA, "Mercado"))?.id).toBe(existing.id);
  });

  it("mesmo nome sob pais diferentes gera dois registros distintos", async () => {
    const map = await batchResolveSubcategories(prisma, userId, [
      { parentId: parentA, name: "Outros" },
      { parentId: parentB, name: "Outros" },
    ]);

    const all = await prisma.category.findMany({ where: { userId, name: "Outros" } });
    expect(all).toHaveLength(2);
    expect(map.get(subcategoryKey(parentA, "Outros"))?.id).not.toBe(map.get(subcategoryKey(parentB, "Outros"))?.id);
  });

  it("20 sub-categorias mistas (10 novas + 10 existentes) resolve todas corretamente", async () => {
    const existingNames = Array.from({ length: 10 }, (_, i) => `Existente${i}`);
    for (const name of existingNames) {
      await prisma.category.create({ data: { userId, name, parentId: parentA } });
    }
    const newNames = Array.from({ length: 10 }, (_, i) => `Nova${i}`);

    const map = await batchResolveSubcategories(
      prisma,
      userId,
      [...existingNames, ...newNames].map((name) => ({ parentId: parentA, name }))
    );

    const all = await prisma.category.findMany({ where: { userId, parentId: parentA } });
    expect(all).toHaveLength(20);
    expect(map.size).toBe(20);
  });

  it("ignora nomes vazios e retorna Map vazio para lista vazia", async () => {
    const map = await batchResolveSubcategories(prisma, userId, [{ parentId: parentA, name: "   " }]);
    expect(map.size).toBe(0);

    const empty = await batchResolveSubcategories(prisma, userId, []);
    expect(empty.size).toBe(0);
  });
});
