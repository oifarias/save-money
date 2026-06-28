import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CreditCardsManager } from "@/components/credit-cards/credit-cards-manager";

export const metadata = { title: "Cartões de crédito" };

export default async function CartoesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const cards = await prisma.creditCard.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  return <CreditCardsManager cards={cards} />;
}
