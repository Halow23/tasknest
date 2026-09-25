/**
 * Scheduled platform cron jobs backed by Firestore.
 */

import {
  createNotification,
  getNotificationsForUser,
} from "./firestore/workspace";
import { db, getDocs, tasksCol, toPlainDoc, usersCol, workspacesCol } from "./firestore/db";
import type { TaskDoc, UserDoc, WorkspaceDoc } from "./firestore/types";
import { sendDailyDigestEmail } from "./digestEmail";
import { purgeExpiredDeletedItems } from "./trash";
import { Timestamp } from "firebase-admin/firestore";

const BELL_ACTOR_PLACEHOLDER_NOTE = "System sweeps act as the workspace owner because notifications.actorId is NOT NULL.";

function startOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function endOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}
function digestAppOrigin() {
  return process.env.DIGEST_APP_ORIGIN || "https://tasknest-api.vercel.app";
}

/** Due-today/overdue notifications per assignee, deduped against unread duplicates. */
export async function runReminderSweep(now = new Date()) {
  const fs = db();
  const workspaces = await getDocs<WorkspaceDoc>(workspacesCol(fs));
  let created = 0;
  let skipped = 0;
  const endTs = Timestamp.fromDate(endOfToday(now));

  for (const ws of workspaces) {
    const tasksSnap = await tasksCol(fs, ws.id)
      .where("deletedAt", "==", null)
      .where("completedAt", "==", null)
      .where("dueAt", "<=", endTs)
      .get();

    const tasks = tasksSnap.docs
      .map((doc) => toPlainDoc<TaskDoc>(doc.id, doc.data()))
      // Convert Timestamps: comparing a raw Firestore Timestamp against a Date
      // yields NaN, which silently made every task look non-overdue.
      .filter((task) => task.dueAt);

    // One read per distinct assignee per workspace (not per task×assignee):
    // snapshot each assignee's recent unread reminders once, dedupe in memory.
    const assigneeIds = Array.from(new Set(tasks.flatMap((task) => task.assigneeIds)));
    const unreadKeys = new Map<string, Set<string>>();
    await Promise.all(
      assigneeIds.map(async (userId) => {
        const existing = await getNotificationsForUser(userId);
        unreadKeys.set(
          userId,
          new Set(existing.filter((n) => !n.readAt).map((n) => `${n.taskId}|${n.type}`)),
        );
      }),
    );

    await Promise.all(
      tasks.flatMap((task) => {
        const isOverdue = !!task.dueAt && task.dueAt < startOfToday(now);
        const type = isOverdue ? "overdue" : "due_today";
        return task.assigneeIds.map(async (userId) => {
          const key = `${task.id}|${type}`;
          const seen = unreadKeys.get(userId);
          if (seen?.has(key)) {
            skipped += 1;
            return;
          }
          seen?.add(key); // also dedupes repeats within this same sweep
          await createNotification({
            userId,
            type,
            actorId: ws.ownerId,
            actorName: "TaskNest",
            taskId: task.id,
            taskTitle: task.title,
            workspaceId: ws.id,
          });
          created += 1;
        });
      }),
    );
  }

  return { created, skipped, note: BELL_ACTOR_PLACEHOLDER_NOTE };
}

/** One digest email per member with due-today/overdue assignments. */
export async function runDigestSweep(now = new Date()) {
  const fs = db();
  const workspaces = await getDocs<WorkspaceDoc>(workspacesCol(fs));
  let sent = 0;
  let skipped = 0;
  const endTs = Timestamp.fromDate(endOfToday(now));

  for (const ws of workspaces) {
    const tasksSnap = await tasksCol(fs, ws.id)
      .where("deletedAt", "==", null)
      .where("completedAt", "==", null)
      .where("dueAt", "<=", endTs)
      .get();
    const tasks = tasksSnap.docs.map((d) => toPlainDoc<TaskDoc>(d.id, d.data()));

    for (const member of ws.members) {
      if (!member.email) {
        skipped += 1;
        continue;
      }
      const assigned = tasks.filter((t) => t.assigneeIds.includes(member.userId));
      const overdue = assigned.filter((t) => t.dueAt && t.dueAt < startOfToday(now));
      const dueToday = assigned.filter((t) => t.dueAt && t.dueAt >= startOfToday(now));
      if (overdue.length === 0 && dueToday.length === 0) {
        skipped += 1;
        continue;
      }
      try {
        await sendDailyDigestEmail({
          recipientEmail: member.email,
          userName: member.name || "there",
          dueToday: dueToday.map((t) => ({ id: t.id as unknown as number, title: t.title, dueAt: t.dueAt, projectName: "" })),
          overdue: overdue.map((t) => ({ id: t.id as unknown as number, title: t.title, dueAt: t.dueAt, projectName: "" })),
          appOrigin: digestAppOrigin(),
        });
        sent += 1;
      } catch {
        skipped += 1;
      }
    }
  }

  return { sent, skipped };
}

export async function runPurgeSweep() {
  return purgeExpiredDeletedItems();
}
