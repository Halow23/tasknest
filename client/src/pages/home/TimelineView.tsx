import { Lock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "./helpers";
import { timelineBarPercents, type TimelineTask } from "./timelineMath";
import { priorityStyle } from "./types";

/** Horizontal timeline: one bar per task spanning creation → due date. */
export function TimelineView({ tasks, onOpenTask }: { tasks: TimelineTask[]; onOpenTask: (taskId: number) => void }) {
  const { bars } = timelineBarPercents(tasks);
  return <div className="flex-1 overflow-auto p-5 lg:p-7">
    <h2 className="font-['DM_Serif_Display'] text-3xl">Work over time.</h2>
    <p className="mt-1 text-sm text-[#718A9A]">Each bar spans from task creation to its deadline; the blue line is today.</p>
    {bars.length === 0 && <div className="mt-10 rounded-2xl border border-dashed border-[#D7E5EB] bg-white p-8 text-center text-sm text-[#7F94A1]">No tasks to place on the timeline yet.</div>}
    {bars.length > 0 && <div className="mt-6 rounded-2xl border border-[#E0EAF0] bg-white p-4">
      <div className="relative" role="list" aria-label="Task timeline">
        <div aria-hidden className="absolute bottom-0 top-0 z-10 w-px bg-[#247EAF]/60" style={{ left: `${timelineBarPercents(tasks).bars.length ? ((todayFraction(tasks)) * 100).toFixed(2) : 0}%` }} />
        {bars.map(bar => <button key={bar.taskId} type="button" role="listitem" onClick={() => onOpenTask(bar.taskId)} className="group mb-3 block w-full text-left" aria-label={`${bar.title}, ${formatDate(bar.isDone ? null : null)}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#27445D]">{bar.title}</span>
            {bar.isBlocked && <Lock className="h-3 w-3 shrink-0 text-[#A36A00]" aria-label="Blocked" />}
            <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold capitalize ring-1 ring-inset", priorityStyle[bar.priority])}>{bar.priority}</span>
          </div>
          <div className="relative h-5 rounded-full bg-[#F2F7FA]">
            <div className={cn("absolute top-0 h-5 rounded-full transition-opacity group-hover:opacity-90",
              bar.isDone ? "bg-[#6EBB92]" : bar.isOverdue ? "bg-[#FF6B5E]" : bar.isBlocked ? "bg-[#E3A55B]" : "bg-[#38A9F2]")}
              style={{ left: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` }}>
              <span className="absolute inset-0 flex items-center justify-center gap-1 overflow-hidden px-1 text-[9px] font-extrabold text-white">
                {bar.isBlocked && <Lock className="h-2.5 w-2.5" />}
              </span>
            </div>
          </div>
        </button>)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-[#EDF2F5] pt-3 text-[9px] font-bold text-[#718A9A]">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#38A9F2]" />On track</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#FF6B5E]" />Overdue</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#E3A55B]" />Blocked</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#6EBB92]" />Done</span>
        <span className="flex items-center gap-1"><Repeat className="h-2.5 w-2.5" />Recurring tasks repeat on completion</span>
      </div>
    </div>}
  </div>;
}

/** Fraction (0–1) of the timeline window where "today" falls, clamped for the marker line. */
export function todayFraction(tasks: TimelineTask[], now = new Date()) {
  const { bars } = timelineBarPercents(tasks, now);
  void bars;
  const starts = tasks.map(task => (task.createdAt ? new Date(task.createdAt).getTime() : now.getTime() - 3 * 86_400_000));
  const windowStart = Math.min(now.getTime() - 3 * 86_400_000, ...(starts.length ? starts : [now.getTime() - 3 * 86_400_000]));
  const dueTimes = tasks.map(task => (task.dueAt ? new Date(task.dueAt).getTime() : now.getTime() + 2 * 86_400_000));
  const windowEnd = Math.max(now.getTime() + 3 * 86_400_000, ...(dueTimes.length ? dueTimes : [now.getTime() + 2 * 86_400_000]));
  const span = Math.max(windowEnd - windowStart, 86_400_000);
  return Math.min(1, Math.max(0, (now.getTime() - windowStart) / span));
}
