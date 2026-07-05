import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { VisualizationGallery } from "@/components/analise/visualization-gallery";

export default async function AnalisePage() {
  const session = await auth();
  const userId = session!.user.id;

  const visualizations = await prisma.savedVisualization.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      chartType: true,
      shareActive: true,
      updatedAt: true,
      filters: true,
    },
  });

  if (visualizations.length === 0) {
    redirect("/analise/nova");
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Minhas análises"
        description="Visualizações salvas de gastos e entradas"
        action={
          <Link
            href="/analise/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-105"
          >
            <Plus className="h-4 w-4" />
            Nova análise
          </Link>
        }
      />
      <VisualizationGallery visualizations={visualizations} />
    </div>
  );
}
