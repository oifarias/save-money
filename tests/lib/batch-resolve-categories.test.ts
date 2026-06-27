import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { batchResolveRootCategories } from "@/lib/category-resolver";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `batch-resolve-categories-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.category.deleteMany({ where: { userId } });
});

describe("batchResolveRootCategories", () => {
  it("cria 1 categoria nova e retorna o id correto no Map", async () => {
    const map = await batchResolveRootCategories(prisma, userId, ["Alimentação"]);

    const created = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(created).toHaveLength(1);
    expect(map.get("Alimentação")?.id).toBe(created[0].id);
  });

  it("reaproveita 1 categoria já existente sem duplicar", async () => {
    const existing = await prisma.category.create({ data: { userId, name: "Transporte" } });

    const map = await batchResolveRootCategories(prisma, userId, ["Transporte"]);

    const all = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(all).toHaveLength(1);
    expect(map.get("Transporte")?.id).toBe(existing.id);
  });

  it("10 categorias (5 novas + 5 existentes) resolve todas corretamente", async () => {
    const existingNames = ["A", "B", "C", "D", "E"];
    for (const name of existingNames) {
      await prisma.category.create({ data: { userId, name } });
    }
    const newNames = ["F", "G", "H", "I", "J"];

    const map = await batchResolveRootCategories(prisma, userId, [...existingNames, ...newNames]);

    const all = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(all).toHaveLength(10);
    expect(map.size).toBe(10);
    for (const name of [...existingNames, ...newNames]) {
      expect(map.get(name)).toBeDefined();
    }
  });

  it("ignora nomes duplicados no input, criando só os registros distintos", async () => {
    await batchResolveRootCategories(prisma, userId, ["Alimentação", "Alimentação", "Transporte"]);

    const all = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(all).toHaveLength(2);
  });

  it("ignora nomes vazios ou só espaços", async () => {
    const map = await batchResolveRootCategories(prisma, userId, ["", "   ", "Lazer"]);

    const all = await prisma.category.findMany({ where: { userId, parentId: null } });
    expect(all).toHaveLength(1);
    expect(map.size).toBe(1);
    expect(map.get("Lazer")).toBeDefined();
  });

  it("retorna Map vazio quando a lista de nomes é vazia", async () => {
    const map = await batchResolveRootCategories(prisma, userId, []);
    expect(map.size).toBe(0);
  });
});
