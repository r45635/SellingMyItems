import { Skeleton } from "@/components/ui/skeleton";

export default function ItemLoading() {
  return (
    <div className="container px-4 md:px-6 py-6 md:py-8 max-w-6xl">
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="grid gap-6 md:grid-cols-5 md:gap-8">
        <div className="md:col-span-3">
          <div className="rounded-xl border overflow-hidden">
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-2 flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-14 rounded" />
              ))}
            </div>
          </div>
        </div>
        <div className="md:col-span-2 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-11 w-full sm:w-40" />
          <div className="rounded-xl border p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="rounded-xl border p-4 flex items-center gap-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
