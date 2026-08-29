import { lt } from "drizzle-orm";
import { projects, tasks } from "../drizzle/schema";
import { requireDb } from "./db";

export const TRASH_RETENTION_DAYS = 30;

/**
 * Hard-deletes soft-deleted items older than the retention window.
 * Projects go first so their cascade removes the tasks inside them;
 * remaining expired tasks (from non-purged projects) are removed after.
 */
export async function purgeExpiredDeletedItems(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS);
  const db = await requireDb();
  await db.delete(projects).where(lt(projects.deletedAt, cutoff));
  await db.delete(tasks).where(lt(tasks.deletedAt, cutoff));
  return { cutoff };
}
