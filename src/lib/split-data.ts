import { prisma } from "@/lib/prisma";

export type PublicSplitItemShare = {
  participantId: string;
  name: string;
  amount: number;
};

export type PublicSplitItem = {
  id: string;
  description: string;
  amount: number;
  date: string;
  note: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  shares: PublicSplitItemShare[];
};

export type PublicSplitParticipant = {
  id: string;
  name: string;
  amount: number;
};

export type PublicSplit = {
  title: string;
  mode: "equal" | "custom";
  showCategories: boolean;
  total: number;
  items: PublicSplitItem[];
  participants: PublicSplitParticipant[];
  createdAt: string;
};

/** Leitura pública por token — sem escopo de userId, o token já é a "senha" do link. */
export async function getSplitByToken(token: string): Promise<PublicSplit | null> {
  const split = await prisma.sharedSplit.findUnique({
    where: { token },
    include: {
      items: {
        orderBy: { date: "desc" },
        include: { shares: { include: { participant: true } } },
      },
      participants: { orderBy: { position: "asc" } },
    },
  });

  if (!split) return null;

  const total = split.items.reduce((sum, item) => sum + item.amount, 0);

  return {
    title: split.title,
    mode: split.mode as "equal" | "custom",
    showCategories: split.showCategories,
    total,
    items: split.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount,
      date: item.date.toISOString(),
      note: item.note,
      categoryName: item.categoryName,
      categoryColor: item.categoryColor,
      shares: item.shares
        .slice()
        .sort((a, b) => a.participant.position - b.participant.position)
        .map((share) => ({
          participantId: share.sharedSplitParticipantId,
          name: share.participant.name,
          amount: share.amount,
        })),
    })),
    participants: split.participants.map((p) => ({ id: p.id, name: p.name, amount: p.amount })),
    createdAt: split.createdAt.toISOString(),
  };
}

export type UserSplitSummary = {
  id: string;
  title: string;
  token: string;
  total: number;
  participantsCount: number;
  createdAt: string;
};

/** Lista os links criados pelo usuário (histórico simples, escopado por userId). */
export async function getUserSplits(userId: string): Promise<UserSplitSummary[]> {
  const splits = await prisma.sharedSplit.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { items: true, participants: { select: { id: true } } },
  });

  return splits.map((split) => ({
    id: split.id,
    title: split.title,
    token: split.token,
    total: split.items.reduce((sum, item) => sum + item.amount, 0),
    participantsCount: split.participants.length,
    createdAt: split.createdAt.toISOString(),
  }));
}
