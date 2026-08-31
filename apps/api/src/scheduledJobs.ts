import { and, eq, isNull, lte } from "drizzle-orm";
import { notifications, projects, taskAssignees, tasks, users, workspaceMembers, workspaces } from "../drizzle/schema";
import { requireDb } from "./db";
import { sendDailyDigestEmail } from "./digestEmail";
import { purgeExpiredDeletedItems } from "./trash";
import { ENV } from "./_core/env";

const BELL_ACTOR_PLACEHOLDER_NOTE = "System sweeps act as the workspace owner because notifications.actorId is NOT NULL.";

function startOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function endOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
function digestAppOrigin() {
  // The cron service calls us without a browser origin; fall back to the known app host.
  return process.env.DIGEST_APP_ORIGIN || "https://tasknest-mrafqspx.manus.space";
}

/** Due-today/overdue notifications per assignee, deduped against unread duplicates. */
export async function runReminderSweep(now = new Date()) {
  const db = await requireDb();
  const dueRows = await db
    .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, projectId: projects.id, workspaceId: projects.workspaceId, ownerId: workspaces.ownerId, userId: taskAssignees.userId })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .where(and(isNull(tasks.deletedAt), isNull(tasks.completedAt), lte(tasks.dueAt, endOfToday(now))));
  let created = 0;
  let skipped = 0;
  for (const row of dueRows) {
    const isOverdue = row.dueAt !== null && row.dueAt < startOfToday(now);
    const type = isOverdue ? "overdue" : "due_today";
    const unread = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, row.userId), eq(notifications.taskId, row.id), eq(notifications.type, type), isNull(notifications.readAt)))
      .limit(1);
    if (unread.length > 0) { skipped += 1; continue; }
    await db.insert(notifications).values({ userId: row.userId, type, actorId: row.ownerId, taskId: row.id, workspaceId: row.workspaceId });
    created += 1;
  }
  return { created, skipped, note: BELL_ACTOR_PLACEHOLDER_NOTE };
}

/** One digest email per member with due-today/overdue assignments. */
export async function runDigestSweep(now = new Date()) {
  const db = await requireDb();
  const members = await db
    .select({ userId: workspaceMembers.userId, email: users.email, name: users.name, workspaceId: workspaces.id, workspaceName: workspaces.name })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id));
  let sent = 0;
  let skipped = 0;
  for (const member of members) {
    if (!member.email) { skipped += 1; continue; }
    const assigned = await db
      .select({ id: tasks.id, title: tasks.title, dueAt: tasks.dueAt, projectName: projects.name })
      .from(taskAssignees)
      .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(taskAssignees.userId, member.userId), eq(projects.workspaceId, member.workspaceId), isNull(tasks.deletedAt), isNull(tasks.completedAt), lte(tasks.dueAt, endOfToday(now))));
    const overdue = assigned.filter(task => task.dueAt !== null && task.dueAt < startOfToday(now));
    const dueToday = assigned.filter(task => task.dueAt !== null && task.dueAt >= startOfToday(now));
    if (overdue.length === 0 && dueToday.length === 0) { skipped += 1; continue; }
    try {
      await sendDailyDigestEmail({ recipientEmail: member.email, userName: member.name || "there", dueToday, overdue, appOrigin: digestAppOrigin() });
      sent += 1;
    } catch {
      skipped += 1;
    }
  }
  return { sent, skipped };
}

export async function runPurgeSweep() {
  return purgeExpiredDeletedItems();
}
