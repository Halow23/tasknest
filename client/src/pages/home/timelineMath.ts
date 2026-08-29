import type { TaskSummary } from "./types";

export type TimelineTask = TaskSummary & { createdAt?: Date | null; completedAt?: Date | null; blockedByCount?: number };

export type TimelineBar = {
  taskId: number;
  title: string;
  status: TaskSummary["status"];
  priority: TaskSummary["priority"];
  leftPercent: number;
  widthPercent: number;
  isDone: boolean;
  isOverdue: boolean;
  isBlocked: boolean;
};

const DAY_MS = 86_400_000;

/**
 * Positions each task as a horizontal bar across the shared window.
 * Bar spans createdAt → dueAt (no dueAt: a 2-day bar from createdAt, or
 * centered on today when created long ago). Percents are 0–100 clamped.
 */
export function timelineBarPercents(tasks: TimelineTask[], now = new Date()): { bars: TimelineBar[]; windowStart: Date; windowEnd: Date } {
  const starts = tasks.map(task => (task.createdAt ? new Date(task.createdAt).getTime() : now.getTime() - 3 * DAY_MS));
  const windowStart = Math.min(now.getTime() - 3 * DAY_MS, ...(starts.length ? starts : [now.getTime() - 3 * DAY_MS]));
  const dueTimes = tasks.map(task => (task.dueAt ? new Date(task.dueAt).getTime() : now.getTime() + 2 * DAY_MS));
  const windowEnd = Math.max(now.getTime() + 3 * DAY_MS, ...(dueTimes.length ? dueTimes : [now.getTime() + 2 * DAY_MS]));
  const span = Math.max(windowEnd - windowStart, DAY_MS);

  const bars = tasks
    .slice()
    .sort((a, b) => Number(a.dueAt ?? Infinity) - Number(b.dueAt ?? Infinity))
    .map(task => {
      const taskStart = task.createdAt ? new Date(task.createdAt).getTime() : windowStart;
      const hasDue = Boolean(task.dueAt);
      const rawEnd = hasDue ? new Date(task.dueAt!).getTime() : Math.min(now.getTime() + DAY_MS, taskStart + 2 * DAY_MS);
      const barStart = Math.max(taskStart, windowStart);
      const barEnd = Math.max(rawEnd, barStart + 0.5 * DAY_MS);
      const leftPercent = Math.min(100, Math.max(0, ((barStart - windowStart) / span) * 100));
      const widthPercent = Math.min(100 - leftPercent, Math.max(1.5, ((barEnd - barStart) / span) * 100));
      return {
        taskId: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        leftPercent,
        widthPercent,
        isDone: task.status === "done",
        isOverdue: hasDue && new Date(task.dueAt!).getTime() < now.getTime() && task.status !== "done",
        isBlocked: (task.blockedByCount ?? 0) > 0,
      } satisfies TimelineBar;
    });

  return { bars, windowStart: new Date(windowStart), windowEnd: new Date(windowEnd) };
}
