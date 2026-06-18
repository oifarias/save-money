import { prisma } from "@/lib/prisma";

/** Retorna a conta mais antiga do usuário — hoje o produto opera com uma única conta por usuário. */
export async function getDefaultAccountId(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return account?.id ?? null;
}
