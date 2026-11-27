import { Card, Skeleton } from "@/components/ui/primitives";

/** Stats + chart placeholders, shown while a category's numbers load. */
export function CategoryStatsSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-3 xs:p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-7 w-7 rounded-lg sm:h-9 sm:w-9 sm:rounded-xl" />
            </div>
            <Skeleton className="mt-2 h-6 w-3/4 sm:h-7" />
            <Skeleton className="mt-2.5 h-3 w-1/2" />
          </Card>
        ))}
      </div>
      <Card className="p-4 sm:p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      </Card>
    </div>
  );
}

/** Whole detail page: header, period row, stats and table. */
export function CategoryDetailSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading category">
      <Skeleton className="mb-4 h-8 w-28" />
      <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48 max-w-[60vw]" />
            <Skeleton className="h-4 w-64 max-w-[60vw]" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[20, 16, 24, 28].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-lg" style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between gap-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-10 w-44 rounded-lg" />
      </div>
      <CategoryStatsSkeleton />
      <span className="sr-only">Loading category…</span>
    </div>
  );
}
