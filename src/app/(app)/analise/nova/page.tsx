import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Explorer } from "@/components/analise/explorer";

export default async function NovaAnalisePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [categories, subcategories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.category.findMany({
      where: { userId, parentId: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, parentId: true },
    }),
    prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <Explorer
      categories={categories}
      subcategories={subcategories.map((s) => ({ ...s, parentId: s.parentId! }))}
      tags={tags}
    />
  );
}
