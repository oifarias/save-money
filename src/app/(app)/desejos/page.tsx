import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWishesPageData } from "@/lib/wish-data";
import { WishesManager } from "@/components/wishes/wishes-manager";

export default async function DesejosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [{ active, purchased, abandoned }, categories] = await Promise.all([
    getWishesPageData(userId),
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
  ]);

  const formCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    children: category.children,
  }));

  return <WishesManager active={active} purchased={purchased} abandoned={abandoned} categories={formCategories} />;
}
