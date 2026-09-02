/**
 * Scheduled platform cron jobs backed by Firestore.
 */

import {
  createNotification,
  getNotificationsForUser,
} from "./firestore/workspace";
import { db, getDocs, tasksCol, usersCol, workspacesCol } from "./firestore/db";
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
  return process.env.DIGEST_APP_ORIGIN || "https://tasknest-mrafqspx.manus.space";
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

    for (const doc of tasksSnap.docs) {
      const task = { id: doc.id, ...doc.data() } as TaskDoc;
      if (!task.dueAt) continue;
      const isOverdue = task.dueAt < startOfToday(now);
      const type = isOverdue ? "overdue" : "due_today";

      for (const userId of task.assigneeIds) {
        // Dedup against unread notifications for this task+type
        const existing = await getNotificationsForUser(userId);
        const hasUnread = existing.some(
          (n) => n.taskId === task.id && n.type === type && !n.readAt,
        );
        if (hasUnread) {
          skipped += 1;
          continue;
        }
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
      }
    }
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
    const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskDoc));

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
