import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="flex flex-col">
      <section className="border-b bg-gradient-to-b from-orange-50/60 to-background dark:from-orange-950/15">
        <div className="container px-4 py-5 md:px-6 md:py-12 mx-auto max-w-3xl flex flex-col items-center text-center gap-3">
          <Skeleton className="h-7 w-3/4 max-w-md" />
          <Skeleton className="h-4 w-4/5 max-w-lg" />
          <Skeleton className="mt-2 h-9 w-full max-w-md" />
          <Skeleton className="h-3 w-2/3 max-w-sm" />
        </div>
      </section>
      <section className="py-5 md:py-10">
        <div className="container px-4 md:px-6">
          <div className="mb-4 flex items-baseline justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-3 sm:p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="hidden sm:block h-3 w-5/6" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
