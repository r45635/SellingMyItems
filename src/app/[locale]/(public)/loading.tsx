import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-orange-50/60 to-background py-10 md:py-14">
        <div className="container px-4 md:px-6 flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-8 w-3/5 max-w-md" />
          <Skeleton className="h-4 w-4/5 max-w-lg" />
        </div>
      </section>
      <section className="py-8 md:py-10">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
            <Skeleton className="h-7 w-40" />
            <div className="sm:ml-auto">
              <Skeleton className="h-9 w-64" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex items-center justify-between pt-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
