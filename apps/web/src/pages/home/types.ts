export type Status = "backlog" | "todo" | "progress" | "review" | "done";
export type Priority = "high" | "medium" | "low";
export type View = "board" | "calendar" | "analytics" | "mytasks" | "timeline" | "workload" | "chat";
export type CalendarMode = "list" | "month";
export type Member = { id: string; name: string | null; email: string | null };
export type TaskSummary = { id: string; title: string; description: string | null; status: Status; priority: Priority; dueAt: Date | null; blockedByCount?: number; recurrenceRule?: "none" | "daily" | "weekly" | "monthly"; sortOrder?: number };

/**
 * Board columns, in display order. Order is significant: `kanbanNavigation.ts`
 * mirrors it for ArrowLeft/ArrowRight movement, and the API's `byStatus`
 * analytics record lists the same statuses.
 *
 * `color` is a Tailwind class for the column indicator dot.
 */
export const columns: { id: Status; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "bg-[#a1a1a1]" },
  { id: "todo", title: "To do", color: "bg-[#a1a1a1]" },
  { id: "progress", title: "In progress", color: "bg-[#2b7fff]" },
  { id: "review", title: "Review", color: "bg-[#ffccd3]" },
  { id: "done", title: "Done", color: "bg-[#d8f999]" },
];

/**
 * Priority pills: soft tinted fill + deep saturated text, no ring.
 * Text values are the darkest that still clear WCAG AA (4.5:1) on their fill.
 */
export const priorityStyle: Record<Priority, string> = {
  high: "bg-[#FFF0EE] text-[#c3443a]",
  medium: "bg-[#FFF8E6] text-[#9e6700]",
  low: "bg-[#F0F5F7] text-[#597080]",
};

export const projectColors = ["#38A9F2", "#6EBB92", "#9B9CE8", "#E3A55B"];
