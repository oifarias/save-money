import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { batchResolveFixedExpenseTemplates, fixedExpenseTemplateKey } from "@/lib/fixed-expense-resolver";

let userId: string;
let categoryId: string;
let otherCategoryId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `batch-resolve-fixed-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
  const category = await prisma.category.create({ data: { userId, name: "Moradia" } });
  const otherCategory = await prisma.category.create({ data: { userId, name: "Lazer" } });
  categoryId = category.id;
  otherCategoryId = otherCategory.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
});

describe("batchResolveFixedExpenseTemplates", () => {
  it("cria 1 template novo com os dados corretos", async () => {
    const map = await batchResolveFixedExpenseTemplates(prisma, userId, [
      { description: "Aluguel", categoryId, amount: 1500, date: new Date(2026, 5, 10) },
    ]);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(1);
    expect(templates[0].description).toBe("Aluguel");
    expect(templates[0].expectedAmount).toBe(1500);
    expect(templates[0].dueDay).toBe(10);
    expect(templates[0].categoryId).toBe(categoryId);
    expect(map.get(fixedExpenseTemplateKey(categoryId, "Aluguel"))).toBe(templates[0].id);
  });

  it("reaproveita template existente com mesma descrição normalizada (case-insensitive)", async () => {
    const existing = await prisma.fixedExpenseTemplate.create({
      data: { userId, description: "Aluguel", expectedAmount: 1500, dueDay: 10, categoryId, isActive: true },
    });

    const map = await batchResolveFixedExpenseTemplates(prisma, userId, [
      { description: "aluguel", categoryId, amount: 1600, date: new Date(2026, 6, 5) },
    ]);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(1);
    expect(templates[0].expectedAmount).toBe(1500); // não sobrescreve dados existentes
    expect(map.get(fixedExpenseTemplateKey(categoryId, "aluguel"))).toBe(existing.id);
  });

  it("mesma descrição em categorias diferentes cria templates separados", async () => {
    await batchResolveFixedExpenseTemplates(prisma, userId, [
      { description: "Assinatura", categoryId, amount: 50, date: new Date(2026, 5, 1) },
      { description: "Assinatura", categoryId: otherCategoryId, amount: 30, date: new Date(2026, 5, 1) },
    ]);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId, description: "Assinatura" } });
    expect(templates).toHaveLength(2);
  });

  it("10 templates (4 existentes + 6 novos) preserva expectedAmount dos existentes", async () => {
    for (let i = 0; i < 4; i++) {
      await prisma.fixedExpenseTemplate.create({
        data: { userId, description: `Fixa${i}`, expectedAmount: 100 + i, dueDay: 5, categoryId, isActive: true },
      });
    }

    const items = Array.from({ length: 10 }, (_, i) => ({
      description: `Fixa${i}`,
      categoryId,
      amount: 999,
      date: new Date(2026, 5, 5),
    }));

    await batchResolveFixedExpenseTemplates(prisma, userId, items);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId } });
    expect(templates).toHaveLength(10);
    for (let i = 0; i < 4; i++) {
      const template = templates.find((t) => t.description === `Fixa${i}`)!;
      expect(template.expectedAmount).toBe(100 + i);
    }
  });

  it("template inativo existente não é reaproveitado; cria um novo ativo", async () => {
    await prisma.fixedExpenseTemplate.create({
      data: { userId, description: "Streaming", expectedAmount: 40, dueDay: 1, categoryId, isActive: false },
    });

    const map = await batchResolveFixedExpenseTemplates(prisma, userId, [
      { description: "Streaming", categoryId, amount: 45, date: new Date(2026, 5, 1) },
    ]);

    const templates = await prisma.fixedExpenseTemplate.findMany({ where: { userId, description: "Streaming" } });
    expect(templates).toHaveLength(2);
    const active = templates.find((t) => t.isActive)!;
    expect(map.get(fixedExpenseTemplateKey(categoryId, "Streaming"))).toBe(active.id);
  });

  it("retorna Map vazio para lista vazia", async () => {
    const map = await batchResolveFixedExpenseTemplates(prisma, userId, []);
    expect(map.size).toBe(0);
  });
});
