import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export { Skeleton };

/** Full-page loading gate: spinner + label (also announced to screen readers). */
export function PageLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#F7FAFB]">
      <Spinner className="h-6 w-6 text-[#38A9F2]" />
      <span className="text-xs font-bold text-[#79909E]">{label}…</span>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Stacked list-row skeletons (icon tile + two lines + trailing chip). */
export function SkeletonRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-6 w-14 shrink-0 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Task-card skeleton matching the TaskCard shape (badge, title, meta, footer). */
function TaskCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#E5EDF2] bg-white p-3.5">
      <Skeleton className="h-4 w-14 rounded-md" />
      <Skeleton className="mt-3 h-3.5 w-full" />
      <Skeleton className="mt-1.5 h-3.5 w-3/5" />
      <div className="mt-3 flex items-center justify-between">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#EDF2F5] pt-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/** Board-shaped skeleton: four kanban lanes of task-card skeletons. */
export function BoardSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading board" className="flex-1 overflow-x-auto">
      <div className="grid min-w-[880px] grid-cols-4 gap-3 p-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, lane) => (
          <div key={lane} className="rounded-2xl bg-[#F1F5F7] p-2.5">
            <Skeleton className="h-6 w-28 rounded-lg" />
            <div className="mt-2 space-y-2">
              <TaskCardSkeleton />
              {lane < 3 && <TaskCardSkeleton />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Alternating chat bubble skeletons for the message thread. */
export function ChatThreadSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading messages" className="space-y-3 px-4 py-4">
      {[false, false, true, false, true, true].map((mine, index) => (
        <div key={index} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
          {!mine && <Skeleton className="h-7 w-7 shrink-0 rounded-full" />}
          <div className={cn("space-y-1.5 rounded-2xl px-3.5 py-2.5", mine ? "bg-[#38A9F2]/40" : "bg-accent", index % 3 === 2 ? "w-1/2" : "w-2/5")}>
            <Skeleton className={cn("h-3 w-40", mine && "bg-white/40")} />
            <Skeleton className={cn("h-3 w-24", mine && "bg-white/30")} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Chat group-list skeletons (icon tile + two lines + unread chip). */
export function ChatGroupsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading conversations" className="space-y-2 px-2 pb-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
          <Skeleton className="h-5 w-7 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Table-body skeleton (rows × columns of pulse cells). */
export function TableSkeleton({ rows = 4, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading records">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 border-t border-[#EDF2F5] px-5 py-3.5 sm:px-6">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <Skeleton key={columnIndex} className={cn("h-4", columnIndex === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Drawer/sheet skeleton mirroring the task-detail layout. */
export function TaskDrawerSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading task" className="space-y-6 px-6 py-6">
      <div>
        <div className="mb-4 flex gap-2">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <div className="mt-5 flex items-center justify-between">
          <Skeleton className="h-7 w-24 rounded-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
