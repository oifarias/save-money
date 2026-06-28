import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DesejosLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* PageHeader */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>

      {/* WishIntake — título + 2 IntakeOption */}
      <section className="flex flex-col gap-4">
        <div>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="flex items-start gap-3 px-4 py-3.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-40" />
            </div>
          </Card>
          <Card className="flex items-start gap-3 px-4 py-3.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-44" />
            </div>
          </Card>
        </div>
      </section>

      {/* Lista de desejos ativos */}
      <section className="flex flex-col gap-4">
        <Skeleton className="h-6 w-36" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Seções colapsáveis (Comprados / Abandonados) */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
