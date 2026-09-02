/**
 * Trash and soft-delete retention sweeps backed by Firestore.
 */

import { db, getDocs, projectsCol, tasksCol, workspacesCol } from "./firestore/db";
import type { ProjectDoc, TaskDoc, WorkspaceDoc } from "./firestore/types";
import { Timestamp } from "firebase-admin/firestore";

export const TRASH_RETENTION_DAYS = 30;

/**
 * Hard-deletes soft-deleted items older than the retention window across all workspaces.
 */
export async function purgeExpiredDeletedItems(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);
  const cutoffTs = Timestamp.fromDate(cutoff);
  const fs = db();

  const workspaces = await getDocs<WorkspaceDoc>(workspacesCol(fs));
  let purgedTasks = 0;
  let purgedProjects = 0;

  for (const ws of workspaces) {
    const [tasksSnap, projsSnap] = await Promise.all([
      tasksCol(fs, ws.id).where("deletedAt", "<=", cutoffTs).get(),
      projectsCol(fs, ws.id).where("deletedAt", "<=", cutoffTs).get(),
    ]);

    if (!tasksSnap.empty || !projsSnap.empty) {
      const batch = fs.batch();
      tasksSnap.docs.forEach((d) => batch.delete(d.ref));
      projsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      purgedTasks += tasksSnap.size;
      purgedProjects += projsSnap.size;
    }
  }

  return { cutoff, purgedTasks, purgedProjects };
}
