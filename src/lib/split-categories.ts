import type { PublicSplit } from "@/lib/split-data";

export const UNCATEGORIZED_LABEL = "Sem categoria";

export type SplitCategoryPerson = {
  participantId: string;
  name: string;
  amount: number;
};

export type SplitCategorySummary = {
  name: string;
  color: string | null;
  total: number;
  people: SplitCategoryPerson[];
};

/**
 * Agrega os lançamentos do link por categoria (snapshot gravado na criação) e, dentro de cada
 * categoria, quanto cada pessoa paga. No modo "custom" soma as shares por participante; no modo
 * "equal" cada lançamento é dividido igualmente entre todos os participantes.
 */
export function summarizeSplitByCategory(
  split: Pick<PublicSplit, "mode" | "items" | "participants">
): SplitCategorySummary[] {
  const byName = new Map<string, SplitCategorySummary & { peopleByParticipant: Map<string, SplitCategoryPerson> }>();

  const equalFraction = split.participants.length > 0 ? 1 / split.participants.length : 0;

  for (const item of split.items) {
    const name = item.categoryName ?? UNCATEGORIZED_LABEL;
    let entry = byName.get(name);
    if (!entry) {
      entry = {
        name,
        color: item.categoryColor,
        total: 0,
        people: [],
        peopleByParticipant: new Map(),
      };
      byName.set(name, entry);
    }

    entry.total += item.amount;

    const contributions: { participantId: string; participantName: string; amount: number }[] =
      split.mode === "custom"
        ? item.shares.map((share) => ({
            participantId: share.participantId,
            participantName: share.name,
            amount: share.amount,
          }))
        : split.participants.map((p) => ({
            participantId: p.id,
            participantName: p.name,
            amount: item.amount * equalFraction,
          }));

    for (const contribution of contributions) {
      if (contribution.amount <= 0) continue;
      const person = entry.peopleByParticipant.get(contribution.participantId);
      if (person) {
        person.amount += contribution.amount;
      } else {
        entry.peopleByParticipant.set(contribution.participantId, {
          participantId: contribution.participantId,
          name: contribution.participantName,
          amount: contribution.amount,
        });
      }
    }
  }

  // Ordena pessoas na ordem original dos participantes, e categorias por total (maior primeiro).
  const participantOrder = new Map(split.participants.map((p, index) => [p.id, index]));

  return Array.from(byName.values())
    .map(({ peopleByParticipant, ...entry }) => ({
      ...entry,
      people: Array.from(peopleByParticipant.values()).sort(
        (a, b) => (participantOrder.get(a.participantId) ?? 0) - (participantOrder.get(b.participantId) ?? 0)
      ),
    }))
    .sort((a, b) => b.total - a.total);
}
