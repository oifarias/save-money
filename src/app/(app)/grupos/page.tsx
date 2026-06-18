import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/groups/category-manager";

export default async function GruposPage() {
  const session = await auth();
  const userId = session!.user.id;

  const categories = await prisma.category.findMany({
    where: { userId, parentId: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { transactions: true } },
      children: {
        orderBy: { name: "asc" },
        include: { _count: { select: { transactions: true } } },
      },
    },
  });

  function mapCategory(category: { id: string; name: string; color: string; icon: string; isDefault: boolean; _count: { transactions: number } }) {
    return {
      id: category.id,
      name: category.name,
      color: category.color,
      icon: category.icon,
      isDefault: category.isDefault,
      transactionCount: category._count.transactions,
    };
  }

  return (
    <CategoryManager
      categories={categories.map((category) => ({
        ...mapCategory(category),
        children: category.children.map(mapCategory),
      }))}
      rootCategories={categories.map((category) => ({ id: category.id, name: category.name }))}
    />
  );
}
