import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ImportarLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>

      <Card className="flex flex-col items-center justify-center gap-4 py-14">
        <Skeleton className="h-16 w-16 rounded-2xl" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </Card>
    </div>
  );
}
