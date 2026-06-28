import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentMonthKey, ensureCurrentMonthBudgets, getBudgetProgress } from "@/lib/budget-data";
import { getWishesPageData } from "@/lib/wish-data";
import { WishesManager } from "@/components/wishes/wishes-manager";
import { WishesBudgetRequired } from "@/components/wishes/wishes-budget-required";

export default async function DesejosPage() {
  const session = await auth();
  const userId = session!.user.id;
  const month = currentMonthKey();

  // ensureCurrentMonthBudgets precisa terminar antes de getBudgetProgress (mesma ordem usada na
  // tela de Metas), senão a leitura pode acontecer antes da cópia do mês anterior e mostrar a
  // sugestão indevidamente para quem já tem metas configuradas.
  await ensureCurrentMonthBudgets(userId, month);
  const progress = await getBudgetProgress(userId, month);

  if (!progress) {
    return <WishesBudgetRequired />;
  }

  const [{ active, purchased, abandoned }, categories] = await Promise.all([
    getWishesPageData(userId, progress),
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
