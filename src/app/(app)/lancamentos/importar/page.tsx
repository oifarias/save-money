import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ImportWizard } from "@/components/transactions/import-wizard";

export default async function LancamentosImportarPage() {
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
        <Link
          href="/lancamentos"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-(--color-primary) hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar para lançamentos
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold text-(--color-text)">Importar planilha</h1>
        <p className="mt-1 text-sm text-(--color-text-muted)">
          Envie um arquivo .xlsx ou .xls, mapeie as colunas e revise os lançamentos antes de confirmar
        </p>
      </div>

      <ImportWizard existingCategories={existingCategories} />
    </div>
  );
}
