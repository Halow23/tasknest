import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  activityEvents,
  attachments,
  comments,
  projects,
  subtasks,
  taskAssignees,
  tasks,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
  type TaskPriority,
  type TaskStatus,
} from "../../drizzle/schema";
import {
  createWorkspaceForUser,
  getFirstWorkspaceForUser,
  getProjectForWorkspace,
  getTaskProject,
  getWorkspaceMember,
  requireDb,
} from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const taskStatusSchema = z.enum(["backlog", "progress", "review", "done"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });
const projectInput = z.object({ projectId: z.number().int().positive() });
const taskInput = z.object({ taskId: z.number().int().positive() });

async function assertWorkspaceMember(workspaceId: number, userId: number) {
  const member = await getWorkspaceMember(workspaceId, userId);
  if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this workspace." });
}

async function assertProjectMember(projectId: number, userId: number) {
  const project = await getTaskNestProject(projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  await assertWorkspaceMember(project.workspaceId, userId);
  return project;
}

async function getTaskNestProject(projectId: number) {
  const db = await requireDb();
  const rows = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  return rows[0];
}

async function assertTaskMember(taskId: number, userId: number) {
  const result = await getTaskProject(taskId);
  if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  await assertWorkspaceMember(result.project.workspaceId, userId);
  return result;
}

async function logActivity(input: {
  workspaceId: number;
  actorId: number;
  type: (typeof activityEvents.type.enumValues)[number];
  projectId?: number;
  taskId?: number;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const db = await requireDb();
  await db.insert(activityEvents).values({
    workspaceId: input.workspaceId,
    actorId: input.actorId,
    type: input.type,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    metadata: input.metadata ?? null,
  });
}

async function getTaskDetail(taskId: number) {
  const db = await requireDb();
  const taskResult = await getTaskProject(taskId);
  if (!taskResult) return null;

  const [assignees, taskSubtasks, taskComments, taskAttachments, activity] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(taskAssignees)
      .innerJoin(users, eq(taskAssignees.userId, users.id))
      .where(eq(taskAssignees.taskId, taskId)),
    db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(asc(subtasks.sortOrder)),
    db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, authorId: users.id, authorName: users.name })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.taskId, taskId))
      .orderBy(asc(comments.createdAt)),
    db.select().from(attachments).where(eq(attachments.taskId, taskId)).orderBy(desc(attachments.createdAt)),
    db
      .select({ id: activityEvents.id, type: activityEvents.type, metadata: activityEvents.metadata, createdAt: activityEvents.createdAt, actorName: users.name })
      .from(activityEvents)
      .innerJoin(users, eq(activityEvents.actorId, users.id))
      .where(eq(activityEvents.taskId, taskId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(20),
  ]);

  return { ...taskResult.task, project: taskResult.project, assignees, subtasks: taskSubtasks, comments: taskComments, attachments: taskAttachments, activity };
}

export const tasknestRouter = router({
  workspace: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const workspace = await getFirstWorkspaceForUser(ctx.user.id);
      if (!workspace) return { workspace: null, members: [], projects: [] };
      const db = await requireDb();
      const [members, availableProjects] = await Promise.all([
        db
          .select({ id: users.id, name: users.name, email: users.email, joinedAt: workspaceMembers.joinedAt })
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, workspace.id))
          .orderBy(asc(workspaceMembers.joinedAt)),
        db.select().from(projects).where(and(eq(projects.workspaceId, workspace.id), eq(projects.archived, false))).orderBy(asc(projects.createdAt)),
      ]);
      return { workspace, members, projects: availableProjects };
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const existing = await getFirstWorkspaceForUser(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already belong to a TaskNest workspace." });
      const workspace = await createWorkspaceForUser(ctx.user.id, input.name);
      if (!workspace) throw new Error("Could not create your workspace.");
      await logActivity({ workspaceId: workspace.id, actorId: ctx.user.id, type: "member_joined", metadata: { action: "workspace_created" } });
      return workspace;
    }),
    createInvite: protectedProcedure.input(workspaceInput).mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      await db.insert(workspaceInvites).values({ workspaceId: input.workspaceId, token, expiresAt, createdById: ctx.user.id });
      return { token, expiresAt };
    }),
    acceptInvite: protectedProcedure.input(z.object({ token: z.string().length(32) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const invite = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, input.token)).limit(1);
      const record = invite[0];
      if (!record || record.acceptedAt || record.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is unavailable or has expired." });
      }
      await db.transaction(async (tx) => {
        await tx.insert(workspaceMembers).values({ workspaceId: record.workspaceId, userId: ctx.user.id }).onDuplicateKeyUpdate({ set: { joinedAt: new Date() } });
        await tx.update(workspaceInvites).set({ acceptedAt: new Date(), acceptedById: ctx.user.id }).where(eq(workspaceInvites.id, record.id));
      });
      await logActivity({ workspaceId: record.workspaceId, actorId: ctx.user.id, type: "member_joined", metadata: { action: "invite_accepted" } });
      return { workspaceId: record.workspaceId };
    }),
  }),
  project: router({
    list: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      return db.select().from(projects).where(and(eq(projects.workspaceId, input.workspaceId), eq(projects.archived, false))).orderBy(asc(projects.createdAt));
    }),
    create: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), name: z.string().trim().min(1).max(120), color: z.string().regex(/^#[A-Fa-f0-9]{6}$/).default("#38A9F2"), description: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const created = await db.insert(projects).values({ workspaceId: input.workspaceId, name: input.name, color: input.color, description: input.description || null, createdById: ctx.user.id });
      const projectId = Number(created[0].insertId);
      const project = await getProjectForWorkspace(projectId, input.workspaceId);
      if (!project) throw new Error("Could not create project.");
      return project;
    }),
  }),
  task: router({
    list: protectedProcedure.input(projectInput).query(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      const taskRows = await db.select().from(tasks).where(eq(tasks.projectId, project.id)).orderBy(asc(tasks.status), asc(tasks.sortOrder), desc(tasks.updatedAt));
      const ids = taskRows.map((task) => task.id);
      if (ids.length === 0) return { tasks: [], assignees: [], project };
      const assignees = await db
        .select({ taskId: taskAssignees.taskId, id: users.id, name: users.name, email: users.email })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.userId, users.id))
        .where(inArray(taskAssignees.taskId, ids));
      return { tasks: taskRows, assignees, project };
    }),
    detail: protectedProcedure.input(taskInput).query(async ({ ctx, input }) => {
      await assertTaskMember(input.taskId, ctx.user.id);
      const detail = await getTaskDetail(input.taskId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      return detail;
    }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().trim().min(1).max(240), description: z.string().trim().max(8000).optional(), priority: taskPrioritySchema.default("medium"), dueAt: z.date().nullable().optional(), assigneeIds: z.array(z.number().int().positive()).max(20).optional() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      if (input.assigneeIds?.length) {
        const db = await requireDb();
        const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, project.workspaceId), inArray(workspaceMembers.userId, input.assigneeIds)));
        if (members.length !== new Set(input.assigneeIds).size) throw new TRPCError({ code: "FORBIDDEN", message: "Tasks can only be assigned to workspace members." });
      }
      const db = await requireDb();
      const created = await db.insert(tasks).values({ projectId: input.projectId, title: input.title, description: input.description || null, priority: input.priority, dueAt: input.dueAt ?? null, sortOrder: Math.floor(Date.now() / 1000), createdById: ctx.user.id });
      const taskId = Number(created[0].insertId);
      if (input.assigneeIds?.length) await db.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId, userId })));
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, taskId, actorId: ctx.user.id, type: "task_created", metadata: { title: input.title } });
      return getTaskDetail(taskId);
    }),
    update: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), title: z.string().trim().min(1).max(240).optional(), description: z.string().trim().max(8000).nullable().optional(), priority: taskPrioritySchema.optional(), dueAt: z.date().nullable().optional(), assigneeIds: z.array(z.number().int().positive()).max(20).optional() })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      if (input.assigneeIds) {
        const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, result.project.workspaceId), inArray(workspaceMembers.userId, input.assigneeIds)));
        if (members.length !== new Set(input.assigneeIds).size) throw new TRPCError({ code: "FORBIDDEN", message: "Tasks can only be assigned to workspace members." });
        await db.transaction(async (tx) => {
          await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, input.taskId));
          if (input.assigneeIds?.length) await tx.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId: input.taskId, userId })));
        });
      }
      const updateSet = { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}), ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}) };
      if (Object.keys(updateSet).length > 0) await db.update(tasks).set(updateSet).where(eq(tasks.id, input.taskId));
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "task_updated" });
      return getTaskDetail(input.taskId);
    }),
    move: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), status: taskStatusSchema, sortOrder: z.number().int().min(0).max(2_147_483_647).optional() })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      const completedAt = input.status === "done" ? new Date() : null;
      await db.update(tasks).set({ status: input.status as TaskStatus, sortOrder: input.sortOrder ?? Math.floor(Date.now() / 1000), completedAt }).where(eq(tasks.id, input.taskId));
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: input.status === "done" ? "task_completed" : "task_moved", metadata: { status: input.status } });
      return getTaskDetail(input.taskId);
    }),
  }),
  subtask: router({
    create: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), title: z.string().trim().min(1).max(240) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      const created = await db.insert(subtasks).values({ taskId: input.taskId, title: input.title, sortOrder: Math.floor(Date.now() / 1000) });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "subtask_updated", metadata: { action: "created" } });
      return { id: Number(created[0].insertId) };
    }),
    toggle: protectedProcedure.input(z.object({ subtaskId: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select({ taskId: subtasks.taskId }).from(subtasks).where(eq(subtasks.id, input.subtaskId)).limit(1);
      const item = rows[0];
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Subtask not found." });
      const result = await assertTaskMember(item.taskId, ctx.user.id);
      await db.update(subtasks).set({ completed: input.completed }).where(eq(subtasks.id, input.subtaskId));
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: item.taskId, actorId: ctx.user.id, type: "subtask_updated", metadata: { completed: input.completed } });
      return { success: true };
    }),
  }),
  comment: router({
    create: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), body: z.string().trim().min(1).max(5000) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      const created = await db.insert(comments).values({ taskId: input.taskId, authorId: ctx.user.id, body: input.body });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "comment_added" });
      return { id: Number(created[0].insertId) };
    }),
  }),
  attachment: router({
    upload: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), dataBase64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const bytes = Buffer.from(input.dataBase64.replace(/^data:[^,]+,/, ""), "base64");
      if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachments must be smaller than 5 MB." });
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const stored = await storagePut(`tasknest/${result.project.workspaceId}/tasks/${input.taskId}/${safeFileName}`, bytes, input.contentType);
      const db = await requireDb();
      const created = await db.insert(attachments).values({ taskId: input.taskId, uploadedById: ctx.user.id, fileName: input.fileName, contentType: input.contentType, byteSize: bytes.byteLength, storageKey: stored.key, storageUrl: stored.url });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "attachment_added", metadata: { fileName: input.fileName } });
      return { id: Number(created[0].insertId), ...stored };
    }),
  }),
  analytics: router({
    project: protectedProcedure.input(projectInput).query(async ({ ctx, input }) => {
      await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      const rows = await db.select({ status: tasks.status, dueAt: tasks.dueAt, completedAt: tasks.completedAt }).from(tasks).where(eq(tasks.projectId, input.projectId));
      const today = new Date();
      const upcoming = new Date(today);
      upcoming.setDate(today.getDate() + 7);
      const byStatus = rows.reduce<Record<TaskStatus, number>>((acc, task) => { acc[task.status] += 1; return acc; }, { backlog: 0, progress: 0, review: 0, done: 0 });
      const total = rows.length;
      const dueThisWeek = rows.filter((task) => task.dueAt && task.dueAt >= today && task.dueAt <= upcoming && task.status !== "done").length;
      const overdue = rows.filter((task) => task.dueAt && task.dueAt < today && task.status !== "done").length;
      return { total, dueThisWeek, overdue, completionRate: total ? Math.round((byStatus.done / total) * 100) : 0, byStatus };
    }),
  }),
});
