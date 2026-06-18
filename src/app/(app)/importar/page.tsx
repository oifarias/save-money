import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const categories = await prisma.category.findMany({
    where: { userId },
    select: { name: true, parent: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const existingCategories = categories.map((category) => ({
    name: category.name,
    parentName: category.parent?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Importar via Excel</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Envie planilhas .xlsx ou .xls, mapeie as colunas e importe seus lançamentos em lote
        </p>
      </div>

      <ImportWizard existingCategories={existingCategories} />
    </div>
  );
}
