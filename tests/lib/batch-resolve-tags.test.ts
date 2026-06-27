import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { batchResolveTags } from "@/lib/tags";

let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `batch-resolve-tags-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.tag.deleteMany({ where: { userId } });
});

describe("batchResolveTags", () => {
  it("cria 5 tags novas e retorna todos os ids no Map", async () => {
    const names = ["lazer", "comida", "viagem", "saude", "casa"];
    const map = await batchResolveTags(prisma, userId, names);

    const all = await prisma.tag.findMany({ where: { userId } });
    expect(all).toHaveLength(5);
    expect(map.size).toBe(5);
  });

  it("reaproveita 5 tags já existentes sem duplicar", async () => {
    const names = ["lazer", "comida", "viagem", "saude", "casa"];
    for (const name of names) {
      await prisma.tag.create({ data: { userId, name } });
    }

    await batchResolveTags(prisma, userId, names);

    const all = await prisma.tag.findMany({ where: { userId } });
    expect(all).toHaveLength(5);
  });

  it("mix de 3 novas + 3 existentes cria só as novas", async () => {
    await prisma.tag.create({ data: { userId, name: "a" } });
    await prisma.tag.create({ data: { userId, name: "b" } });
    await prisma.tag.create({ data: { userId, name: "c" } });

    const map = await batchResolveTags(prisma, userId, ["a", "b", "c", "d", "e", "f"]);

    const all = await prisma.tag.findMany({ where: { userId } });
    expect(all).toHaveLength(6);
    expect(map.size).toBe(6);
  });

  it('normaliza tags com "#" no início', async () => {
    const map = await batchResolveTags(prisma, userId, ["#lazer"]);

    const all = await prisma.tag.findMany({ where: { userId } });
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("lazer");
    expect(map.get("lazer")).toBeDefined();
  });

  it("tags duplicadas no input criam só 2 registros distintos", async () => {
    await batchResolveTags(prisma, userId, ["lazer", "lazer", "comida"]);

    const all = await prisma.tag.findMany({ where: { userId } });
    expect(all).toHaveLength(2);
  });

  it("retorna Map vazio para lista vazia ou só de nomes inválidos", async () => {
    const map = await batchResolveTags(prisma, userId, ["", "  ", "#"]);
    expect(map.size).toBe(0);
  });
});
