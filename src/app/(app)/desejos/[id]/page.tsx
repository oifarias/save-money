import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWishDetail } from "@/lib/wish-data";
import { WishDetailView } from "@/components/wishes/wish-detail-view";

type WishDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function WishDetailPage({ params }: WishDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const [wish, availableGoals] = await Promise.all([
    getWishDetail(userId, id),
    prisma.goal.findMany({
      where: { userId, wishId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, targetAmount: true, currentAmount: true },
    }),
  ]);

  if (!wish) {
    notFound();
  }

  return <WishDetailView wish={wish} availableGoals={availableGoals} />;
}
