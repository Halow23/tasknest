import type { TaskSummary } from "./types";

export type WorkloadMember = { id: string; name: string | null; email: string | null };

export type WorkloadEntry = {
  member: WorkloadMember;
  open: number;
  done: number;
  overdue: number;
  highPriority: number;
  tasks: TaskSummary[];
};

export type WorkloadAssignment = { taskId: string; userId: string; name: string | null; email: string | null };

/** Inverts the flat assignee list into per-member load, ordered by open count (desc). */
export function groupWorkload(tasks: TaskSummary[], assignments: WorkloadAssignment[], members: WorkloadMember[], now = new Date()): WorkloadEntry[] {
  const byUser = new Map<string, WorkloadEntry>();
  const ensure = (member: WorkloadMember) => {
    let entry = byUser.get(member.id);
    if (!entry) { entry = { member, open: 0, done: 0, overdue: 0, highPriority: 0, tasks: [] }; byUser.set(member.id, entry); }
    return entry;
  };
  members.forEach(ensure);
  const taskById = new Map(tasks.map(task => [task.id, task]));
  for (const assignment of assignments) {
    const task = taskById.get(assignment.taskId);
    if (!task) continue;
    const entry = ensure({ id: assignment.userId, name: assignment.name, email: assignment.email });
    entry.tasks.push(task);
    if (task.status === "done") { entry.done += 1; continue; }
    entry.open += 1;
    if (task.dueAt && new Date(task.dueAt) < now) entry.overdue += 1;
    if (task.priority === "high") entry.highPriority += 1;
  }
  return Array.from(byUser.values()).sort((a, b) => b.open - a.open || b.overdue - a.overdue);
}
