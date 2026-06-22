import { Skeleton } from "@/components/ui/skeleton";

export default function RecuperarSenhaLoading() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 shadow-sm">
      <Skeleton className="h-6 w-40 self-center" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  );
}
