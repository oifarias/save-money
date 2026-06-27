import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const sessionUserId = { current: "" };

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => (sessionUserId.current ? { user: { id: sessionUserId.current } } : null)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { importTransactionsAction, type ImportRowPayload } from "@/app/(app)/lancamentos/import-actions";

let userId: string;

function rowFor(overrides: Partial<ImportRowPayload> = {}): ImportRowPayload {
  return {
    date: "2026-06-10",
    description: "Compra",
    amount: "150",
    type: "EXPENSE",
    category: "",
    subcategory: "",
    tags: "",
    installments: "",
    isFixed: "",
    ...overrides,
  };
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: "Teste", email: `import-load-${Date.now()}@example.com`, passwordHash: "x" },
  });
  userId = user.id;
  await prisma.financialAccount.create({ data: { userId, name: "Conta", type: "wallet" } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

beforeEach(async () => {
  sessionUserId.current = userId;
  await prisma.transaction.deleteMany({ where: { userId } });
  await prisma.installmentPlan.deleteMany({ where: { userId } });
  await prisma.fixedExpenseTemplate.deleteMany({ where: { userId } });
  await prisma.tag.deleteMany({ where: { userId } });
  await prisma.category.deleteMany({ where: { userId } });
});

describe("importTransactionsAction — carga real (T14)", () => {
  it("307 linhas (simples + fixas) importam em < 10s com imported = 307", async () => {
    const categories = ["Alimentação", "Transporte", "Lazer", "Moradia", "Saúde"];
    const tagPool = ["fixo", "lazer", "viagem", "trabalho"];

    const rows: ImportRowPayload[] = [];

    // 267 linhas simples, variando categoria/tags
    for (let i = 0; i < 267; i++) {
      rows.push(
        rowFor({
          description: `Lançamento ${i}`,
          amount: String(50 + (i % 30)),
          category: categories[i % categories.length],
          tags: `${tagPool[i % tagPool.length]},${tagPool[(i + 1) % tagPool.length]}`,
        })
      );
    }

    // 40 linhas de despesa fixa (poucas descrições recorrentes, sem expandir em mais transactions)
    const fixedDescriptions = ["Aluguel", "Internet", "Streaming", "Condomínio"];
    for (let i = 0; i < 40; i++) {
      rows.push(
        rowFor({
          description: fixedDescriptions[i % fixedDescriptions.length],
          amount: "200",
          category: "Moradia",
          isFixed: "sim",
        })
      );
    }

    expect(rows).toHaveLength(307);

    const start = Date.now();
    const result = await importTransactionsAction(rows);
    const durationMs = Date.now() - start;

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(0);
    expect(result.imported).toBe(307);
    expect(durationMs).toBeLessThan(10_000);

    const transactionCount = await prisma.transaction.count({ where: { userId } });
    expect(transactionCount).toBe(307);
  });
});
