import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLoading() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/70 via-background to-background">
        <div className="container relative px-4 py-6 md:px-6 md:py-10">
          <Skeleton className="h-7 w-28" />
          <div className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
            <div className="md:col-span-2 space-y-4">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-4 w-full max-w-xl" />
              <Skeleton className="h-4 w-5/6 max-w-xl" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
            <div className="md:col-span-1">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <Skeleton className="h-3 w-16" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="py-8 md:py-10">
        <div className="container px-4 md:px-6">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card overflow-hidden">
                <div className="aspect-[4/3] rounded-lg bg-muted animate-pulse" />
                <div className="p-2.5 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <div className="h-4 w-16 rounded bg-muted animate-pulse mt-1" />
                  <Skeleton className="h-3 w-1/3 mt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
