import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionFilters } from "@/lib/validations/transaction-filters";
import { getComparativeData } from "@/lib/comparative-data";
import { FiltersPanel } from "@/components/transactions/filters-panel";
import { ComparativeExplorer } from "@/components/comparative/comparative-explorer";
import { PageHeader } from "@/components/ui/page-header";

type ComparativoPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ComparativoPage({ searchParams }: ComparativoPageProps) {
  const session = await auth();
  const userId = session!.user.id;

  const rawSearchParams = await searchParams;
  const filters = parseTransactionFilters(rawSearchParams);

  const [data, categories] = await Promise.all([
    getComparativeData(userId, filters),
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Comparativo mês a mês" description="Compare dois ou mais meses por grupo, com variação percentual e exportação" />

      <FiltersPanel categories={formCategories} />

      <ComparativeExplorer data={data} />
    </div>
  );
}
