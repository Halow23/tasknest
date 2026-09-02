import { CalendarDays, CheckCircle2, Clock3, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "./helpers";
import { priorityStyle, type Priority } from "./types";

export type MyTask = { id: string; title: string; status: string; priority: Priority; dueAt: Date | null; projectId: string; projectName: string; projectColor: string };

function bucketOf(dueAt: Date | null): "overdue" | "today" | "week" | "later" | "none" {
  if (!dueAt) return "none";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
  const due = new Date(dueAt);
  if (due < startOfToday) return "overdue";
  if (due < endOfToday) return "today";
  if (due < endOfWeek) return "week";
  return "later";
}

const bucketOrder = ["overdue", "today", "week", "later", "none"] as const;
const bucketMeta: Record<(typeof bucketOrder)[number], { title: string; note: string }> = {
  overdue: { title: "Overdue", note: "Needs attention now" },
  today: { title: "Today", note: "Due before tomorrow" },
  week: { title: "This week", note: "Coming up in 7 days" },
  later: { title: "Later", note: "Further out" },
  none: { title: "No due date", note: "Schedule when ready" },
};

/** Personal cross-project view: every task assigned to the current member that is not done. */
export function MyTasksView({ tasks, onOpenTask }: { tasks: MyTask[]; onOpenTask: (taskId: string) => void }) {
  const grouped = new Map<(typeof bucketOrder)[number], MyTask[]>();
  tasks.forEach(task => {
    const bucket = bucketOf(task.dueAt);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), task]);
  });
  return <div className="flex-1 overflow-auto p-5 lg:p-7">
    <h2 className="font-['DM_Serif_Display'] text-3xl">Your plate, across every project.</h2>
    <p className="mt-1 text-sm text-[#718A9A]">Every open task assigned to you, ordered by urgency.</p>
    {tasks.length === 0 && <div className="mt-10 flex max-w-md flex-col items-center rounded-2xl border border-dashed border-[#D7E5EB] bg-white p-8 text-center">
      <CheckCircle2 className="h-8 w-8 text-[#6EBB92]" />
      <p className="mt-3 text-sm font-extrabold text-[#27445D]">Nothing assigned to you right now.</p>
      <p className="mt-1 text-xs text-[#718A9A]">When a teammate assigns you work, it will show up here.</p>
    </div>}
    <div className="mt-6 space-y-6">
      {bucketOrder.map(bucket => {
        const bucketTasks = grouped.get(bucket) ?? [];
        if (bucketTasks.length === 0) return null;
        const meta = bucketMeta[bucket];
        return <section key={bucket} aria-label={meta.title}>
          <div className="flex items-baseline gap-2"><h3 className="text-sm font-extrabold text-[#253B56]">{meta.title}</h3><span className="text-[11px] font-bold text-[#8AA0AF]">{bucketTasks.length}</span><span className="text-[10px] font-semibold text-[#8B9EAA]">· {meta.note}</span></div>
          <div className="mt-2 space-y-2">
            {bucketTasks.map(task => <button key={task.id} onClick={() => onOpenTask(task.id)} className="flex w-full items-center gap-3 rounded-xl border border-[#E2EBF0] bg-white p-3.5 text-left hover:border-[#BDE6FF] hover:shadow-[0_6px_16px_rgba(21,54,74,0.06)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-extrabold text-[#172B4D]">{task.title}</span><span className="block truncate text-[10px] font-bold text-[#718A9A]">{task.projectName}</span></span>
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset", priorityStyle[task.priority])}>{task.priority}</span>
              <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#718491]"><Clock3 className="h-3 w-3" />{formatDate(task.dueAt)}</span>
            </button>)}
          </div>
        </section>;
      })}
    </div>
  </div>;
}
