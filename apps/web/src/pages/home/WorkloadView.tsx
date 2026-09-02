import { AlertTriangle, Flame, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Faces } from "./helpers";
import { groupWorkload, type WorkloadAssignment, type WorkloadMember } from "./workloadMath";
import { priorityStyle, type TaskSummary } from "./types";

/** Per-member load for the active project, from the board's assignee data. */
export function WorkloadView({ tasks, assignments, members, onOpenTask }: {
  tasks: TaskSummary[];
  assignments: WorkloadAssignment[];
  members: WorkloadMember[];
  onOpenTask: (taskId: string) => void;
}) {
  const entries = groupWorkload(tasks, assignments, members);
  return <div className="flex-1 overflow-auto p-5 lg:p-7">
    <h2 className="font-['DM_Serif_Display'] text-3xl">Who is carrying what.</h2>
    <p className="mt-1 text-sm text-[#718A9A]">Open work per teammate in {""}this project, heaviest first.</p>
    {entries.length === 0 && <div className="mt-10 rounded-2xl border border-dashed border-[#D7E5EB] bg-white p-8 text-center text-sm text-[#7F94A1]">No teammates to show yet.</div>}
    <div className="mt-6 space-y-3">
      {entries.map(entry => <section key={entry.member.id} aria-label={`Workload for ${entry.member.name || entry.member.email || "Teammate"}`} className="rounded-2xl border border-[#E2EBF0] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3"><Faces members={[entry.member]} /><div><p className="text-[13px] font-extrabold text-[#172B4D]">{entry.member.name || entry.member.email || "Teammate"}</p><p className="text-[10px] font-semibold text-[#718A9A]">{entry.member.email || "workspace member"}</p></div></div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold">
            <span className="flex items-center gap-1 rounded-full bg-[#EAF6FF] px-2 py-1 text-[#2474A3]"><Loader2 className="h-3 w-3" />{entry.open} open</span>
            <span className="flex items-center gap-1 rounded-full bg-[#FFF0EE] px-2 py-1 text-[#D44A3F]"><AlertTriangle className="h-3 w-3" />{entry.overdue} overdue</span>
            <span className="flex items-center gap-1 rounded-full bg-[#FFF8E6] px-2 py-1 text-[#A36A00]"><Flame className="h-3 w-3" />{entry.highPriority} high</span>
            <span className="rounded-full bg-[#F0F5F7] px-2 py-1 text-[#597080]">{entry.done} done</span>
          </div>
        </div>
        {entry.tasks.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{entry.tasks.slice(0, 8).map(task => <button key={task.id} onClick={() => onOpenTask(task.id)} className={cn("max-w-56 truncate rounded-lg px-2 py-1 text-[10px] font-bold ring-1 ring-inset transition-opacity hover:opacity-80", priorityStyle[task.priority], task.status === "done" && "line-through opacity-60")} aria-label={`Open ${task.title}`}>{task.title}</button>)}</div>}
      </section>)}
    </div>
  </div>;
}
