import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MetasLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-44" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <div className="flex items-center gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-7 w-7 rounded-full" />
        ))}
      </div>

      <Card className="flex flex-col gap-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-10 w-32 self-end rounded-xl" />
      </Card>
    </div>
  );
}
