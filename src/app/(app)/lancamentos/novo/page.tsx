import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TransactionBatchPanel } from "@/components/transactions/transaction-batch-panel";

export const metadata = { title: "Novo lançamento" };

export default async function NovoLancamentoPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [categories, tags] = await Promise.all([
    prisma.category.findMany({
      where: { userId, parentId: null },
      orderBy: { name: "asc" },
      include: { children: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.tag.findMany({ where: { userId }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const formCategories = categories.map((category) => ({
    id: category.id,
    name: category.name,
    children: category.children,
  }));
  const tagSuggestions = tags.map((tag) => tag.name);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/lancamentos"
          className="inline-flex items-center justify-center rounded-xl p-2 text-(--color-text-muted) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
          aria-label="Voltar para lançamentos"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="font-display text-xl font-semibold text-(--color-text)">Novo lançamento</h1>
          <p className="text-sm text-(--color-text-muted)">Adicione um ou mais lançamentos de uma só vez</p>
        </div>
      </div>

      <TransactionBatchPanel categories={formCategories} tagSuggestions={tagSuggestions} />
    </div>
  );
}
