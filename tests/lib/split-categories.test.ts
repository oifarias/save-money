import { describe, expect, it } from "vitest";
import { summarizeSplitByCategory, UNCATEGORIZED_LABEL } from "@/lib/split-categories";
import type { PublicSplitItem, PublicSplitParticipant } from "@/lib/split-data";

function makeItem(overrides: Partial<PublicSplitItem> & Pick<PublicSplitItem, "id" | "amount">): PublicSplitItem {
  return {
    description: "Lançamento",
    date: "2026-09-01T00:00:00.000Z",
    note: null,
    categoryName: null,
    categoryColor: null,
    shares: [],
    ...overrides,
  };
}

const participants: PublicSplitParticipant[] = [
  { id: "p1", name: "Pessoa 1", amount: 350 },
  { id: "p2", name: "Pessoa 2", amount: 350 },
];

describe("summarizeSplitByCategory", () => {
  it("agrupa por categoria, soma os totais e ordena do maior para o menor", () => {
    const summaries = summarizeSplitByCategory({
      mode: "equal",
      participants,
      items: [
        makeItem({ id: "a", amount: 100, categoryName: "Casa", categoryColor: "#111111" }),
        makeItem({ id: "b", amount: 200, categoryName: "Casa", categoryColor: "#111111" }),
        makeItem({ id: "c", amount: 300, categoryName: "Transporte", categoryColor: "#222222" }),
        makeItem({ id: "d", amount: 100, categoryName: "Pets", categoryColor: "#333333" }),
      ],
    });

    expect(summaries.map((s) => [s.name, s.total])).toEqual([
      ["Casa", 300],
      ["Transporte", 300],
      ["Pets", 100],
    ]);
    expect(summaries[0].color).toBe("#111111");
  });

  it("no modo equal divide cada categoria igualmente entre os participantes", () => {
    const summaries = summarizeSplitByCategory({
      mode: "equal",
      participants,
      items: [makeItem({ id: "a", amount: 300, categoryName: "Casa" })],
    });

    expect(summaries[0].people).toEqual([
      { participantId: "p1", name: "Pessoa 1", amount: 150 },
      { participantId: "p2", name: "Pessoa 2", amount: 150 },
    ]);
  });

  it("no modo custom soma as shares de cada pessoa dentro da categoria", () => {
    const summaries = summarizeSplitByCategory({
      mode: "custom",
      participants,
      items: [
        makeItem({
          id: "a",
          amount: 300,
          categoryName: "Casa",
          shares: [
            { participantId: "p1", name: "Pessoa 1", amount: 100 },
            { participantId: "p2", name: "Pessoa 2", amount: 200 },
          ],
        }),
        makeItem({
          id: "b",
          amount: 50,
          categoryName: "Casa",
          shares: [{ participantId: "p2", name: "Pessoa 2", amount: 50 }],
        }),
      ],
    });

    expect(summaries[0].total).toBe(350);
    expect(summaries[0].people).toEqual([
      { participantId: "p1", name: "Pessoa 1", amount: 100 },
      { participantId: "p2", name: "Pessoa 2", amount: 250 },
    ]);
  });

  it("agrupa lançamentos sem categoria sob o rótulo padrão", () => {
    const summaries = summarizeSplitByCategory({
      mode: "equal",
      participants,
      items: [makeItem({ id: "a", amount: 80 })],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0].name).toBe(UNCATEGORIZED_LABEL);
    expect(summaries[0].total).toBe(80);
  });

  it("não lista pessoas com valor zero no modo custom", () => {
    const summaries = summarizeSplitByCategory({
      mode: "custom",
      participants,
      items: [
        makeItem({
          id: "a",
          amount: 100,
          categoryName: "Pets",
          shares: [{ participantId: "p1", name: "Pessoa 1", amount: 100 }],
        }),
      ],
    });

    expect(summaries[0].people).toEqual([{ participantId: "p1", name: "Pessoa 1", amount: 100 }]);
  });
});
