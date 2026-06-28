import { Skeleton } from "@/components/ui/skeleton";
import { CreditCardSkeleton } from "@/components/credit-cards/credit-card-skeleton";

export default function CartoesLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* PageHeader skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <CreditCardSkeleton />
    </div>
  );
}
