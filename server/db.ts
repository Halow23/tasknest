import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  projects,
  tasks,
  users,
  workspaceMembers,
  workspaces,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let dbInstance: ReturnType<typeof drizzle> | null = null;

// The database client is deliberately lazy so editor tooling does not need a connection.
export async function getDb() {
  if (!dbInstance && process.env.DATABASE_URL) {
    dbInstance = drizzle(process.env.DATABASE_URL);
  }
  return dbInstance;
}

export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("TaskNest database is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  (["name", "email", "loginMethod"] as const).forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await requireDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getFirstWorkspaceForUser(userId: number) {
  const db = await requireDb();
  const result = await db
    .select({ workspace: workspaces })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt))
    .limit(1);
  return result[0]?.workspace;
}

export async function createWorkspaceForUser(userId: number, name: string) {
  const db = await requireDb();
  return db.transaction(async (tx) => {
    const created = await tx.insert(workspaces).values({ name, ownerId: userId });
    const workspaceId = Number(created[0].insertId);
    await tx.insert(workspaceMembers).values({ workspaceId, userId });
    const workspace = await tx.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return workspace[0];
  });
}

export async function getWorkspaceMember(workspaceId: number, userId: number) {
  const db = await requireDb();
  const result = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getProjectForWorkspace(projectId: number, workspaceId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);
  return result[0];
}

export async function getTaskProject(taskId: number) {
  const db = await requireDb();
  const result = await db
    .select({ task: tasks, project: projects })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(eq(tasks.id, taskId))
    .limit(1);
  return result[0];
}
