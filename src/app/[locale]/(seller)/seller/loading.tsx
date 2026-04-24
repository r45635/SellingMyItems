import { Skeleton } from "@/components/ui/skeleton";

export default function SellerDashboardLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-48 mb-6" />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card p-4 flex flex-col gap-2"
          >
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-5 mb-8 space-y-4">
        <Skeleton className="h-4 w-36" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-2.5 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  );
}
