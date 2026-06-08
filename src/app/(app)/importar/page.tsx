import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportarPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-text)">Importar via Excel</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Envie planilhas .xlsx ou .xls, mapeie as colunas e importe seus lançamentos em lote
        </p>
      </div>

      <ImportWizard accounts={accounts} categories={categories} />
    </div>
  );
}
