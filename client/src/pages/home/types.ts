export type Status = "backlog" | "progress" | "review" | "done";
export type Priority = "high" | "medium" | "low";
export type View = "board" | "calendar" | "analytics" | "mytasks" | "timeline" | "workload";
export type CalendarMode = "list" | "month";
export type Member = { id: number; name: string | null; email: string | null };
export type TaskSummary = { id: number; title: string; description: string | null; status: Status; priority: Priority; dueAt: Date | null; blockedByCount?: number; recurrenceRule?: "none" | "daily" | "weekly" | "monthly"; sortOrder?: number };

export const columns: { id: Status; title: string; note: string; color: string }[] = [
  { id: "backlog", title: "Up next", note: "Shape the work", color: "bg-slate-400" },
  { id: "progress", title: "In progress", note: "Moving now", color: "bg-[#38A9F2]" },
  { id: "review", title: "In review", note: "Needs a decision", color: "bg-[#FF6B5E]" },
  { id: "done", title: "Complete", note: "Closed work", color: "bg-[#6EBB92]" },
];

export const priorityStyle: Record<Priority, string> = {
  high: "bg-[#FFF0EE] text-[#D44A3F] ring-[#FFD3CE]",
  medium: "bg-[#FFF8E6] text-[#A36A00] ring-[#F5DCA0]",
  low: "bg-[#F0F5F7] text-[#597080] ring-[#DDE8ED]",
};

export const projectColors = ["#38A9F2", "#6EBB92", "#9B9CE8", "#E3A55B"];
