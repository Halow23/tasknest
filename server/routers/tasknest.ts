import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  activityEvents,
  attachments,
  comments,
  labels,
  notifications,
  projectFields,
  projects,
  subtasks,
  taskAssignees,
  taskFieldValues,
  taskLabels,
  taskDependencies,
  tasks,
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
  type NotificationType,
  type ProjectFieldType,
  type TaskPriority,
  type TaskRecurrenceRule,
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
import { sendWorkspaceInvitationEmail } from "../invitationEmail";
import { publishWorkspaceEvent } from "../events";
import { storagePresignPutUrl, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const taskStatusSchema = z.enum(["backlog", "progress", "review", "done"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);
const projectFieldTypeSchema = z.enum(["text", "select", "date"]);
const taskRecurrenceSchema = z.enum(["none", "daily", "weekly", "monthly"]);
const fieldOptionsSchema = z.array(z.string().trim().min(1).max(80)).min(1).max(20);
const fieldValueInputSchema = z.object({ fieldId: z.number().int().positive(), value: z.string().trim().max(2000) });
const labelColorSchema = z.string().regex(/^#[A-Fa-f0-9]{6}$/);

const workspaceInput = z.object({ workspaceId: z.number().int().positive() });
const workspaceInviteInput = workspaceInput.extend({ recipientEmail: z.string().trim().email().max(320) });
const projectInput = z.object({ projectId: z.number().int().positive() });
const taskInput = z.object({ taskId: z.number().int().positive() });

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/**
 * Validates custom field values against the field definitions of the task's
 * project and returns the rows to persist. Empty values are dropped so the
 * stored answer is removed (replace-all semantics like assignees).
 */
async function resolveFieldValues(input: { projectId: number; fieldValues?: { fieldId: number; value: string }[] }) {
  const entries = input.fieldValues?.filter((entry) => entry.value.length > 0) ?? [];
  if (entries.length === 0) return [];
  const db = await requireDb();
  const fieldRows = await db.select().from(projectFields).where(inArray(projectFields.id, entries.map((entry) => entry.fieldId)));
  const fieldsById = new Map(fieldRows.map((field) => [field.id, field]));
  const rows: { fieldId: number; value: string }[] = [];
  for (const entry of entries) {
    const field = fieldsById.get(entry.fieldId);
    if (!field || field.projectId !== input.projectId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Custom fields must belong to the task's project." });
    }
    if (field.type === "select") {
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      if (!options.includes(entry.value)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `“${entry.value}” is not an option for ${field.name}.` });
      }
    } else if (field.type === "date" && !isValidIsoDate(entry.value)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${field.name} requires a valid date (YYYY-MM-DD).` });
    }
    rows.push({ fieldId: field.id, value: entry.value });
  }
  return rows;
}

async function writeFieldValues(taskId: number, rows: { fieldId: number; value: string }[]) {
  if (rows.length === 0) return;
  const db = await requireDb();
  await db.insert(taskFieldValues).values(rows.map((row) => ({ taskId, fieldId: row.fieldId, value: row.value }))).onDuplicateKeyUpdate({ set: { value: sql`values(value)` } });
}

/**
 * Validates label ids against the workspace of the task's project.
 * Returns the validated label ids in input order (deduplicated).
 */
async function resolveLabelIds(workspaceId: number, labelIds?: number[]) {
  const unique = Array.from(new Set(labelIds ?? []));
  if (unique.length === 0) return [];
  const db = await requireDb();
  const rows = await db.select({ id: labels.id }).from(labels).where(and(eq(labels.workspaceId, workspaceId), inArray(labels.id, unique)));
  if (rows.length !== unique.length) throw new TRPCError({ code: "FORBIDDEN", message: "Labels must belong to the task's workspace." });
  return unique;
}

async function writeTaskLabels(taskId: number, labelIds: number[]) {
  if (labelIds.length === 0) return;
  const db = await requireDb();
  await db.insert(taskLabels).values(labelIds.map((labelId) => ({ taskId, labelId }))).onDuplicateKeyUpdate({ set: { labelId: sql`values(labelId)` } });
}

/**
 * Queues in-app notifications for the given recipients, silently skipping the actor,
 * invalid ids, and duplicate recipients. Failures never block the triggering mutation.
 */
async function notifyUsers(input: { workspaceId: number; taskId?: number; actorId: number; type: NotificationType; recipientIds: number[] }) {
  const recipientIds = Array.from(new Set(input.recipientIds.filter(id => id && id !== input.actorId)));
  if (recipientIds.length === 0) return;
  try {
    const db = await requireDb();
    await db.insert(notifications).values(recipientIds.map(userId => ({ userId, type: input.type, actorId: input.actorId, taskId: input.taskId ?? null, workspaceId: input.workspaceId })));
  } catch {
    // Notification failures must not fail the triggering mutation.
  }
}

/**
 * Resolves @-mentions in a comment body against workspace members.
 * Matches a member by full name, first name token, or email local-part,
 * case-insensitively, when preceded by an @ and not followed by name chars.
 */
export function extractMentionedUserIds(body: string, members: { id: number; name: string | null; email: string | null }[]): number[] {
  const mentioned: number[] = [];
  for (const member of members) {
    const candidates = [member.name, member.name?.split(/\s+/)[0], member.email?.split("@")[0]]
      .filter((value): value is string => Boolean(value && value.length >= 2));
    const matched = candidates.some(candidate => {
      const escaped = candidate.replace(/[.*+?^$(){}[\]\\]/g, "\\$&");
      const pattern = new RegExp("@" + escaped + "(?![A-Za-z0-9._-])", "i");
      return pattern.test(body);
    });
    if (matched) mentioned.push(member.id);
  }
  return mentioned;
}

/**
 * Returns true when adding taskId -> dependsOnTaskId would create a cycle");
      ");
const pattern = new RegExp(`@${escaped}(?![A-Za-z0-9._-])`, "i");
      return pattern.test(body);
    });
    if (matched) mentioned.push(member.id);
  }
  return mentioned;
}
/**
 * Returns true when adding taskId -> dependsOnTaskId would create a cycle
 * (i.e. taskId already transitively depends on dependsOnTaskId).
 */
async function dependencyWouldCycle(taskId: number, dependsOnTaskId: number) {
  const db = await requireDb();
  const edges = await db.select({ taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId }).from(taskDependencies);
  const dependents = new Map<number, number[]>();
  for (const edge of edges) dependents.set(edge.taskId, [...(dependents.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
  const seen = new Set<number>([taskId]);
  const queue = [taskId];
  while (queue.length) {
    const current = queue.shift()!;
    if (current === dependsOnTaskId) return true;
    for (const next of dependents.get(current) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return false;
}

/** Open (not done) prerequisites for a set of tasks, keyed by taskId. */
async function openDependenciesForTask(taskId: number) {
  const db = await requireDb();
  return db
    .select({ dependencyId: taskDependencies.id, id: tasks.id, title: tasks.title, status: tasks.status })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.dependsOnTaskId, tasks.id))
    .where(and(eq(taskDependencies.taskId, taskId), sql`${tasks.completedAt} is null`))
    .orderBy(asc(taskDependencies.id));
}

function advanceDueDate(base: Date | null, rule: TaskRecurrenceRule, completedAt: Date) {
  if (rule === "none") return null;
  const from = base ?? completedAt;
  const next = new Date(from);
  if (rule === "daily") next.setDate(next.getDate() + 1);
  if (rule === "weekly") next.setDate(next.getDate() + 7);
  if (rule === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * When a recurring task is completed, inserts its next instance (fresh backlog item)
 * copying the work definition: title, description, priority, recurrence, assignees,
 * labels, custom-field values, and subtasks. Returns the new task id or null.
 */
async function spawnRecurringTask(taskId: number, workspaceId: number, completedAt: Date): Promise<number | null> {
  const db = await requireDb();
  const rows = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  const source = rows[0];
  if (!source || source.recurrenceRule === "none") return null;
  const created = await db.insert(tasks).values({
    projectId: source.projectId,
    title: source.title,
    description: source.description,
    status: "backlog",
    priority: source.priority,
    recurrenceRule: source.recurrenceRule,
    dueAt: advanceDueDate(source.dueAt, source.recurrenceRule, completedAt),
    sortOrder: Math.floor(Date.now() / 1000),
    createdById: source.createdById,
    completedAt: null,
  });
  const nextTaskId = Number(created[0].insertId);
  const [assigneeRows, labelRows, fieldRows, subtaskRows] = await Promise.all([
    db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, taskId)),
    db.select({ labelId: taskLabels.labelId }).from(taskLabels).where(eq(taskLabels.taskId, taskId)),
    db.select({ fieldId: taskFieldValues.fieldId, value: taskFieldValues.value }).from(taskFieldValues).where(eq(taskFieldValues.taskId, taskId)),
    db.select({ title: subtasks.title, completed: subtasks.completed, sortOrder: subtasks.sortOrder }).from(subtasks).where(eq(subtasks.taskId, taskId)).orderBy(asc(subtasks.sortOrder)),
  ]);
  if (assigneeRows.length) await db.insert(taskAssignees).values(assigneeRows.map(row => ({ taskId: nextTaskId, userId: row.userId })));
  if (labelRows.length) await db.insert(taskLabels).values(labelRows.map(row => ({ taskId: nextTaskId, labelId: row.labelId })));
  if (fieldRows.length) await db.insert(taskFieldValues).values(fieldRows.map(row => ({ taskId: nextTaskId, fieldId: row.fieldId, value: row.value })));
  if (subtaskRows.length) await db.insert(subtasks).values(subtaskRows.map(row => ({ taskId: nextTaskId, title: row.title, completed: false, sortOrder: row.sortOrder })));
  await logActivity({ workspaceId, projectId: source.projectId, taskId: nextTaskId, actorId: source.createdById, type: "task_created", metadata: { action: "recurrence_spawned", sourceTaskId: taskId, recurrenceRule: source.recurrenceRule } });
  return nextTaskId;
}

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

async function assertLabelMember(labelId: number, userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(labels).where(eq(labels.id, labelId)).limit(1);
  const label = rows[0];
  if (!label) throw new TRPCError({ code: "NOT_FOUND", message: "Label not found." });
  await assertWorkspaceMember(label.workspaceId, userId);
  return label;
}

async function assertFieldMember(fieldId: number, userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ field: projectFields, workspaceId: projects.workspaceId })
    .from(projectFields)
    .innerJoin(projects, eq(projectFields.projectId, projects.id))
    .where(eq(projectFields.id, fieldId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Custom field not found." });
  await assertWorkspaceMember(row.workspaceId, userId);
  return { ...row.field, workspaceId: row.workspaceId };
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
  publishWorkspaceEvent({ workspaceId: input.workspaceId, type: input.type, projectId: input.projectId ?? null, taskId: input.taskId ?? null, actorId: input.actorId, at: new Date().toISOString() });
}

async function getTaskDetail(taskId: number) {
  const db = await requireDb();
  const taskResult = await getTaskProject(taskId);
  if (!taskResult) return null;

  const [assignees, taskSubtasks, taskComments, taskAttachments, activity, fieldValues, taskLabelRows] = await Promise.all([
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
    db
      .select({ fieldId: taskFieldValues.fieldId, value: taskFieldValues.value, name: projectFields.name, type: projectFields.type, options: projectFields.options })
      .from(taskFieldValues)
      .innerJoin(projectFields, eq(taskFieldValues.fieldId, projectFields.id))
      .where(eq(taskFieldValues.taskId, taskId)),
    db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(taskLabels)
      .innerJoin(labels, eq(taskLabels.labelId, labels.id))
      .where(eq(taskLabels.taskId, taskId)),
  ]);

  const openDependencies = await openDependenciesForTask(taskId);
  return { ...taskResult.task, project: taskResult.project, assignees, subtasks: taskSubtasks, comments: taskComments, attachments: taskAttachments, activity, fieldValues, labels: taskLabelRows, openDependencies };
}

export const tasknestRouter = router({
  workspace: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const workspace = await getFirstWorkspaceForUser(ctx.user.id);
      if (!workspace) return { workspace: null, members: [], projects: [], labels: [], archivedProjects: [] };
      const db = await requireDb();
      const [members, availableProjects, workspaceLabels, archivedProjects] = await Promise.all([
        db
          .select({ id: users.id, name: users.name, email: users.email, joinedAt: workspaceMembers.joinedAt })
          .from(workspaceMembers)
          .innerJoin(users, eq(workspaceMembers.userId, users.id))
          .where(eq(workspaceMembers.workspaceId, workspace.id))
          .orderBy(asc(workspaceMembers.joinedAt)),
        db.select().from(projects).where(and(eq(projects.workspaceId, workspace.id), eq(projects.archived, false))).orderBy(asc(projects.createdAt)),
        db.select({ id: labels.id, name: labels.name, color: labels.color }).from(labels).where(eq(labels.workspaceId, workspace.id)).orderBy(asc(labels.name)),
        db.select({ id: projects.id, name: projects.name, color: projects.color, archived: projects.archived, createdAt: projects.createdAt }).from(projects).where(and(eq(projects.workspaceId, workspace.id), eq(projects.archived, true))).orderBy(asc(projects.name))
      ]);
      return { workspace, members, projects: availableProjects, labels: workspaceLabels, archivedProjects };
    }),
    create: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120) })).mutation(async ({ ctx, input }) => {
      const existing = await getFirstWorkspaceForUser(ctx.user.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already belong to a TaskNest workspace." });
      const workspace = await createWorkspaceForUser(ctx.user.id, input.name);
      if (!workspace) throw new Error("Could not create your workspace.");
      await logActivity({ workspaceId: workspace.id, actorId: ctx.user.id, type: "member_joined", metadata: { action: "workspace_created" } });
      return workspace;
    }),
    createInvite: protectedProcedure.input(workspaceInviteInput).mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const token = crypto.randomUUID().replace(/-/g, "");
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
      const recipientEmail = input.recipientEmail.toLowerCase();
      const created = await db.insert(workspaceInvites).values({ workspaceId: input.workspaceId, token, recipientEmail, expiresAt, createdById: ctx.user.id });
      return { id: Number(created[0].insertId), token, recipientEmail, expiresAt };
    }),
    pendingInvites: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const invites = await db
        .select({ id: workspaceInvites.id, token: workspaceInvites.token, recipientEmail: workspaceInvites.recipientEmail, expiresAt: workspaceInvites.expiresAt, createdAt: workspaceInvites.createdAt })
        .from(workspaceInvites)
        .where(and(eq(workspaceInvites.workspaceId, input.workspaceId), isNull(workspaceInvites.acceptedAt), isNull(workspaceInvites.revokedAt), gt(workspaceInvites.expiresAt, new Date())))
        .orderBy(desc(workspaceInvites.createdAt))
        .limit(100);
      return invites;
    }),
    revokeInvite: protectedProcedure.input(z.object({ inviteId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const invites = await db.select().from(workspaceInvites).where(eq(workspaceInvites.id, input.inviteId)).limit(1);
      const invite = invites[0];
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
      await assertWorkspaceMember(invite.workspaceId, ctx.user.id);
      if (invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only active pending invitations can be revoked." });
      }
      await db.update(workspaceInvites).set({ revokedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
      return { revokedInviteId: invite.id };
    }),
    sendInviteEmail: protectedProcedure.input(z.object({ inviteId: z.number().int().positive(), appOrigin: z.string().url().max(500) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const invites = await db.select().from(workspaceInvites).where(eq(workspaceInvites.id, input.inviteId)).limit(1);
      const invite = invites[0];
      if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
      await assertWorkspaceMember(invite.workspaceId, ctx.user.id);
      if (!invite.recipientEmail || invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() <= Date.now()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only active invitations with a recipient email can be delivered." });
      }
      const workspacesForInvite = await db.select().from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);
      const workspaceForInvite = workspacesForInvite[0];
      if (!workspaceForInvite) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found." });
      const appOrigin = new URL(input.appOrigin);
      if (appOrigin.protocol !== "https:" && appOrigin.protocol !== "http:") throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation link requires a valid application URL." });
      const emailId = await sendWorkspaceInvitationEmail({ recipientEmail: invite.recipientEmail, workspaceName: workspaceForInvite.name, inviteUrl: `${appOrigin.origin}/?invite=${invite.token}`, expiresAt: invite.expiresAt });
      return { inviteId: invite.id, emailId };
    }),
    acceptInvite: protectedProcedure.input(z.object({ token: z.string().length(32) })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const invite = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, input.token)).limit(1);
      const record = invite[0];
      if (!record || record.acceptedAt || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is unavailable or has expired." });
      }
      if (record.recipientEmail && record.recipientEmail.toLowerCase() !== (ctx.user.email || "").toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: "This invitation was issued for a different email address." });
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
    update: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(2000).nullable().optional(), color: z.string().regex(/^#[A-Fa-f0-9]{6}$/).optional() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      const updateSet = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      };
      if (Object.keys(updateSet).length === 0) return project;
      await db.update(projects).set(updateSet).where(eq(projects.id, input.projectId));
      return getTaskNestProject(input.projectId);
    }),
    delete: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), confirmation: z.string().trim().min(1).max(120) })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      if (input.confirmation !== project.name) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the exact project name to delete it." });
      }
      const db = await requireDb();
      await db.delete(projects).where(eq(projects.id, input.projectId));
      return { deletedProjectId: project.id };
    }),
    archive: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      await db.update(projects).set({ archived: true }).where(eq(projects.id, input.projectId));
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, actorId: ctx.user.id, type: "task_updated", metadata: { action: "project_archived", projectName: project.name } });
      return { archivedProjectId: project.id };
    }),
    unarchive: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      await db.update(projects).set({ archived: false }).where(eq(projects.id, input.projectId));
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, actorId: ctx.user.id, type: "task_updated", metadata: { action: "project_unarchived", projectName: project.name } });
      return { unarchivedProjectId: project.id };
    }),
  }),
  task: router({
    list: protectedProcedure.input(projectInput.extend({
      assigneeId: z.number().int().positive().nullable().optional(),
      priority: taskPrioritySchema.optional(),
      labelId: z.number().int().positive().nullable().optional(),
      dueBucket: z.enum(["overdue", "today", "week", "none"]).optional(),
    })).query(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      const conditions = [eq(tasks.projectId, project.id)];
      if (input.priority) conditions.push(eq(tasks.priority, input.priority));
      if (input.assigneeId) conditions.push(inArray(tasks.id, db.select({ id: taskAssignees.taskId }).from(taskAssignees).where(eq(taskAssignees.userId, input.assigneeId))));
      if (input.labelId) conditions.push(inArray(tasks.id, db.select({ id: taskLabels.taskId }).from(taskLabels).where(eq(taskLabels.labelId, input.labelId))));
      if (input.dueBucket) {
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
        if (input.dueBucket === "overdue") conditions.push(sql`${tasks.completedAt} is null and ${tasks.dueAt} is not null and ${tasks.dueAt} < now()`);
        if (input.dueBucket === "today") conditions.push(sql`${tasks.dueAt} >= now() and ${tasks.dueAt} < ${endOfToday}`);
        if (input.dueBucket === "week") conditions.push(sql`${tasks.dueAt} >= now() and ${tasks.dueAt} < ${endOfWeek}`);
        if (input.dueBucket === "none") conditions.push(isNull(tasks.dueAt));
      }
      const taskRows = await db.select().from(tasks).where(and(...conditions)).orderBy(asc(tasks.status), asc(tasks.sortOrder), desc(tasks.updatedAt));
      const ids = taskRows.map((task) => task.id);
      if (ids.length === 0) return { tasks: taskRows, assignees: [], labels: [], project };
      const [assignees, taskLabelRows] = await Promise.all([
        db
          .select({ taskId: taskAssignees.taskId, id: users.id, name: users.name, email: users.email })
          .from(taskAssignees)
          .innerJoin(users, eq(taskAssignees.userId, users.id))
          .where(inArray(taskAssignees.taskId, ids)),
        db
          .select({ taskId: taskLabels.taskId, id: labels.id, name: labels.name, color: labels.color })
          .from(taskLabels)
          .innerJoin(labels, eq(taskLabels.labelId, labels.id))
          .where(inArray(taskLabels.taskId, ids)),
      ]);
      const dependencyRows = ids.length > 0 ? await db
        .select({ taskId: taskDependencies.taskId, dependsOnTaskId: taskDependencies.dependsOnTaskId })
        .from(taskDependencies)
        .where(inArray(taskDependencies.taskId, ids)) : [];
      const completedTaskIds = new Set(taskRows.filter(task => task.completedAt !== null).map(task => task.id));
      const openDependencyCount = new Map<number, number>();
      for (const edge of dependencyRows) {
        if (completedTaskIds.has(edge.dependsOnTaskId)) continue;
        openDependencyCount.set(edge.taskId, (openDependencyCount.get(edge.taskId) ?? 0) + 1);
      }
      const tasksWithBlocking = taskRows.map(task => ({ ...task, blockedByCount: openDependencyCount.get(task.id) ?? 0 }));
      return { tasks: tasksWithBlocking, assignees, labels: taskLabelRows, project };
    }),
    search: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(30).default(15) })).query(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const pattern = `%${input.query.replace(/[%_]/g, match => `\\${match}`)}%`;
      const matchingIds = db
        .select({ id: comments.taskId })
        .from(comments)
        .where(sql`${comments.body} like ${pattern}`);
      const rows = await db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt, projectId: projects.id, projectName: projects.name, projectColor: projects.color })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(
          eq(projects.workspaceId, input.workspaceId),
          sql`(${tasks.title} like ${pattern} or ${tasks.description} like ${pattern} or ${tasks.id} in ${matchingIds})`,
        ))
        .orderBy(desc(tasks.updatedAt))
        .limit(input.limit);
      return rows;
    }),
    detail: protectedProcedure.input(taskInput).query(async ({ ctx, input }) => {
      await assertTaskMember(input.taskId, ctx.user.id);
      const detail = await getTaskDetail(input.taskId);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
      return detail;
    }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), title: z.string().trim().min(1).max(240), description: z.string().trim().max(8000).optional(), priority: taskPrioritySchema.default("medium"), dueAt: z.date().nullable().optional(), recurrenceRule: taskRecurrenceSchema.optional(), assigneeIds: z.array(z.number().int().positive()).max(20).optional(), fieldValues: z.array(fieldValueInputSchema).max(30).optional(), labelIds: z.array(z.number().int().positive()).max(20).optional() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      if (input.assigneeIds?.length) {
        const db = await requireDb();
        const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, project.workspaceId), inArray(workspaceMembers.userId, input.assigneeIds)));
        if (members.length !== new Set(input.assigneeIds).size) throw new TRPCError({ code: "FORBIDDEN", message: "Tasks can only be assigned to workspace members." });
      }
      const fieldRows = await resolveFieldValues({ projectId: project.id, fieldValues: input.fieldValues });
      const labelIdRows = await resolveLabelIds(project.workspaceId, input.labelIds);
      const db = await requireDb();
      const created = await db.insert(tasks).values({ projectId: input.projectId, title: input.title, description: input.description || null, priority: input.priority, recurrenceRule: input.recurrenceRule ?? "none", dueAt: input.dueAt ?? null, sortOrder: Math.floor(Date.now() / 1000), createdById: ctx.user.id });
      const taskId = Number(created[0].insertId);
      if (input.assigneeIds?.length) await db.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId, userId })));
      await notifyUsers({ workspaceId: project.workspaceId, taskId, actorId: ctx.user.id, type: "assigned", recipientIds: input.assigneeIds ?? [] });
      await writeFieldValues(taskId, fieldRows);
      await writeTaskLabels(taskId, labelIdRows);
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, taskId, actorId: ctx.user.id, type: "task_created", metadata: { title: input.title } });
      return { taskId, projectId: project.id };
    }),
    update: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), title: z.string().trim().min(1).max(240).optional(), description: z.string().trim().max(8000).nullable().optional(), priority: taskPrioritySchema.optional(), dueAt: z.date().nullable().optional(), recurrenceRule: taskRecurrenceSchema.optional(), assigneeIds: z.array(z.number().int().positive()).max(20).optional(), fieldValues: z.array(fieldValueInputSchema).max(30).optional(), labelIds: z.array(z.number().int().positive()).max(20).optional() })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const fieldRows = input.fieldValues !== undefined ? await resolveFieldValues({ projectId: result.project.id, fieldValues: input.fieldValues }) : null;
      const labelIdRows = input.labelIds !== undefined ? await resolveLabelIds(result.project.workspaceId, input.labelIds) : null;
      const db = await requireDb();
      if (input.assigneeIds) {
        const members = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, result.project.workspaceId), inArray(workspaceMembers.userId, input.assigneeIds)));
        if (members.length !== new Set(input.assigneeIds).size) throw new TRPCError({ code: "FORBIDDEN", message: "Tasks can only be assigned to workspace members." });
        await db.transaction(async (tx) => {
          await tx.delete(taskAssignees).where(eq(taskAssignees.taskId, input.taskId));
          if (input.assigneeIds?.length) await tx.insert(taskAssignees).values(input.assigneeIds.map((userId) => ({ taskId: input.taskId, userId })));
        });
      }
      if (fieldRows !== null) {
        await db.transaction(async (tx) => {
          await tx.delete(taskFieldValues).where(eq(taskFieldValues.taskId, input.taskId));
          if (fieldRows.length) await tx.insert(taskFieldValues).values(fieldRows.map((row) => ({ taskId: input.taskId, fieldId: row.fieldId, value: row.value })));
        });
      }
      if (labelIdRows !== null) {
        await db.transaction(async (tx) => {
          await tx.delete(taskLabels).where(eq(taskLabels.taskId, input.taskId));
          if (labelIdRows.length) await tx.insert(taskLabels).values(labelIdRows.map((labelId) => ({ taskId: input.taskId, labelId })));
        });
      }
      if (input.assigneeIds !== undefined && input.assigneeIds.length > 0) {
        const previousAssignees = await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, input.taskId));
        const previous = new Set(previousAssignees.map(row => row.userId));
        const freshAssignees = input.assigneeIds.filter(userId => !previous.has(userId));
        await notifyUsers({ workspaceId: result.project.workspaceId, taskId: input.taskId, actorId: ctx.user.id, type: "assigned", recipientIds: freshAssignees });
      }
      const updateSet = { ...(input.title !== undefined ? { title: input.title } : {}), ...(input.description !== undefined ? { description: input.description } : {}), ...(input.priority !== undefined ? { priority: input.priority } : {}), ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}), ...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {}) };
      if (Object.keys(updateSet).length > 0) await db.update(tasks).set(updateSet).where(eq(tasks.id, input.taskId));
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "task_updated" });
      return { taskId: input.taskId, projectId: result.project.id };
    }),
    delete: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), confirmation: z.string().trim().min(1).max(240) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      if (input.confirmation !== result.task.title) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the exact task title to delete it." });
      }
      const db = await requireDb();
      await db.delete(tasks).where(eq(tasks.id, input.taskId));
      return { deletedTaskId: input.taskId, projectId: result.project.id };
    }),
    move: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), status: taskStatusSchema, sortOrder: z.number().int().min(0).max(2_147_483_647).optional() })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      if (input.status === "done") {
        const openDependencies = await openDependenciesForTask(input.taskId);
        if (openDependencies.length > 0) {
          const names = openDependencies.map(dependency => `"${dependency.title}"`).join(", ");
          throw new TRPCError({ code: "BAD_REQUEST", message: `Blocked by open dependencies: ${names}. Complete them first.` });
        }
      }
      const completedAt = input.status === "done" ? new Date() : null;
      await db.update(tasks).set({ status: input.status as TaskStatus, sortOrder: input.sortOrder ?? Math.floor(Date.now() / 1000), completedAt }).where(eq(tasks.id, input.taskId));
      let spawnedTaskId: number | null = null;
      if (input.status === "done") {
        spawnedTaskId = await spawnRecurringTask(input.taskId, result.project.workspaceId, completedAt!);
      }
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: input.status === "done" ? "task_completed" : "task_moved", metadata: { status: input.status, ...(spawnedTaskId !== null ? { spawnedTaskId } : {}) } });
      return { taskId: input.taskId, projectId: result.project.id, status: input.status, spawnedTaskId };
    }),
    reorder: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), status: taskStatusSchema, orderedTaskIds: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      const laneRows = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.projectId, project.id), eq(tasks.status, input.status)));
      const laneIds = new Set(laneRows.map(row => row.id));
      const ordered = input.orderedTaskIds;
      if (ordered.length !== laneIds.size || ordered.some(id => !laneIds.has(id))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reorder must include every task in the lane exactly once." });
      }
      await db.transaction(async (tx) => {
        for (let index = 0; index < ordered.length; index++) {
          await tx.update(tasks).set({ sortOrder: index * 10 }).where(eq(tasks.id, ordered[index]));
        }
      });
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, actorId: ctx.user.id, type: "task_moved", metadata: { action: "lane_reordered", status: input.status } });
      return { projectId: project.id, status: input.status };
    }),
    myTasks: protectedProcedure.query(async ({ ctx }) => {
      const workspace = await getFirstWorkspaceForUser(ctx.user.id);
      if (!workspace) return [];
      const db = await requireDb();
      return db
        .select({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority, dueAt: tasks.dueAt, projectId: projects.id, projectName: projects.name, projectColor: projects.color })
        .from(taskAssignees)
        .innerJoin(tasks, eq(taskAssignees.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(and(eq(taskAssignees.userId, ctx.user.id), sql`${tasks.completedAt} is null`, eq(projects.workspaceId, workspace.id), eq(projects.archived, false)))
        .orderBy(sql`${tasks.dueAt} is null`, asc(tasks.dueAt));
    }),
  }),
  dependency: router({
    list: protectedProcedure.input(taskInput).query(async ({ ctx, input }) => {
      await assertTaskMember(input.taskId, ctx.user.id);
      return openDependenciesForTask(input.taskId);
    }),
    create: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), dependsOnTaskId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (input.taskId === input.dependsOnTaskId) throw new TRPCError({ code: "BAD_REQUEST", message: "A task cannot depend on itself." });
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const prerequisite = await assertTaskMember(input.dependsOnTaskId, ctx.user.id);
      if (result.project.id !== prerequisite.project.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Dependencies must stay within the same project." });
      const db = await requireDb();
      const existing = await db.select({ id: taskDependencies.id }).from(taskDependencies).where(and(eq(taskDependencies.taskId, input.taskId), eq(taskDependencies.dependsOnTaskId, input.dependsOnTaskId))).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "This dependency already exists." });
      if (await dependencyWouldCycle(input.taskId, input.dependsOnTaskId)) throw new TRPCError({ code: "BAD_REQUEST", message: "This dependency would create a circular chain." });
      const created = await db.insert(taskDependencies).values({ taskId: input.taskId, dependsOnTaskId: input.dependsOnTaskId, createdById: ctx.user.id });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "task_updated", metadata: { action: "dependency_added", dependsOnTaskId: input.dependsOnTaskId } });
      return { dependencyId: Number(created[0].insertId) };
    }),
    delete: protectedProcedure.input(z.object({ dependencyId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      const rows = await db.select({ dependency: taskDependencies, workspaceId: projects.workspaceId, projectId: projects.id })
        .from(taskDependencies)
        .innerJoin(tasks, eq(taskDependencies.taskId, tasks.id))
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(taskDependencies.id, input.dependencyId)).limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Dependency not found." });
      await assertWorkspaceMember(row.workspaceId, ctx.user.id);
      await db.delete(taskDependencies).where(eq(taskDependencies.id, input.dependencyId));
      await logActivity({ workspaceId: row.workspaceId, projectId: row.projectId, taskId: row.dependency.taskId, actorId: ctx.user.id, type: "task_updated", metadata: { action: "dependency_removed" } });
      return { deletedDependencyId: input.dependencyId };
    }),
  }),
  label: router({
    list: protectedProcedure.input(workspaceInput).query(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      return db.select().from(labels).where(eq(labels.workspaceId, input.workspaceId)).orderBy(asc(labels.name));
    }),
    create: protectedProcedure.input(z.object({ workspaceId: z.number().int().positive(), name: z.string().trim().min(1).max(40), color: labelColorSchema.default("#38A9F2") })).mutation(async ({ ctx, input }) => {
      await assertWorkspaceMember(input.workspaceId, ctx.user.id);
      const db = await requireDb();
      const existing = await db.select({ id: labels.id }).from(labels).where(and(eq(labels.workspaceId, input.workspaceId), eq(labels.name, input.name))).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "A label with this name already exists." });
      const created = await db.insert(labels).values({ workspaceId: input.workspaceId, name: input.name, color: input.color, createdById: ctx.user.id });
      return { labelId: Number(created[0].insertId), name: input.name, color: input.color };
    }),
    update: protectedProcedure.input(z.object({ labelId: z.number().int().positive(), name: z.string().trim().min(1).max(40).optional(), color: labelColorSchema.optional() })).mutation(async ({ ctx, input }) => {
      const label = await assertLabelMember(input.labelId, ctx.user.id);
      const db = await requireDb();
      const updateSet = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      };
      if (Object.keys(updateSet).length === 0) return { labelId: label.id };
      await db.update(labels).set(updateSet).where(eq(labels.id, input.labelId));
      return { labelId: label.id };
    }),
    delete: protectedProcedure.input(z.object({ labelId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const label = await assertLabelMember(input.labelId, ctx.user.id);
      const db = await requireDb();
      await db.delete(labels).where(eq(labels.id, input.labelId));
      return { deletedLabelId: label.id };
    }),
  }),
  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const rows = await db
        .select({ id: notifications.id, type: notifications.type, readAt: notifications.readAt, createdAt: notifications.createdAt, actorName: users.name, taskId: notifications.taskId, taskTitle: tasks.title, projectName: projects.name })
        .from(notifications)
        .innerJoin(users, eq(notifications.actorId, users.id))
        .leftJoin(tasks, eq(notifications.taskId, tasks.id))
        .leftJoin(projects, eq(tasks.projectId, projects.id))
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(sql`${notifications.readAt} is not null`, desc(notifications.createdAt))
        .limit(50);
      return { notifications: rows, unreadCount: rows.filter(row => !row.readAt).length };
    }),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await requireDb();
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, input.notificationId), eq(notifications.userId, ctx.user.id)));
      return { markedNotificationId: input.notificationId };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await requireDb();
      await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)));
      return { success: true };
    }),
  }),
  field: router({
    list: protectedProcedure.input(projectInput).query(async ({ ctx, input }) => {
      await assertProjectMember(input.projectId, ctx.user.id);
      const db = await requireDb();
      return db.select().from(projectFields).where(eq(projectFields.projectId, input.projectId)).orderBy(asc(projectFields.sortOrder), asc(projectFields.createdAt));
    }),
    create: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().trim().min(1).max(60), type: projectFieldTypeSchema.default("text"), options: fieldOptionsSchema.optional() })).mutation(async ({ ctx, input }) => {
      const project = await assertProjectMember(input.projectId, ctx.user.id);
      if (input.type === "select" && !input.options) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dropdown fields need at least one option." });
      }
      const db = await requireDb();
      const existing = await db.select({ id: projectFields.id }).from(projectFields).where(and(eq(projectFields.projectId, input.projectId), eq(projectFields.name, input.name))).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "A custom field with this name already exists in the project." });
      const created = await db.insert(projectFields).values({ projectId: input.projectId, name: input.name, type: input.type as ProjectFieldType, options: input.type === "select" ? input.options ?? null : null, sortOrder: Math.floor(Date.now() / 1000), createdById: ctx.user.id });
      const fieldId = Number(created[0].insertId);
      await logActivity({ workspaceId: project.workspaceId, projectId: project.id, actorId: ctx.user.id, type: "task_updated", metadata: { action: "custom_field_created", fieldName: input.name, fieldType: input.type } });
      return { fieldId, projectId: project.id };
    }),
    update: protectedProcedure.input(z.object({ fieldId: z.number().int().positive(), name: z.string().trim().min(1).max(60).optional(), options: fieldOptionsSchema.optional() })).mutation(async ({ ctx, input }) => {
      const field = await assertFieldMember(input.fieldId, ctx.user.id);
      const db = await requireDb();
      const updateSet = {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.options !== undefined && field.type === "select" ? { options: input.options } : {}),
      };
      if (Object.keys(updateSet).length === 0) return { fieldId: field.id };
      await db.update(projectFields).set(updateSet).where(eq(projectFields.id, input.fieldId));
      return { fieldId: field.id };
    }),
    delete: protectedProcedure.input(z.object({ fieldId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const field = await assertFieldMember(input.fieldId, ctx.user.id);
      const db = await requireDb();
      await db.delete(projectFields).where(eq(projectFields.id, input.fieldId));
      await logActivity({ workspaceId: field.workspaceId, projectId: field.projectId, actorId: ctx.user.id, type: "task_updated", metadata: { action: "custom_field_deleted", fieldName: field.name } });
      return { deletedFieldId: field.id };
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
      const commentId = Number(created[0].insertId);
      const taskAssigneeRows = await db.select({ userId: taskAssignees.userId }).from(taskAssignees).where(eq(taskAssignees.taskId, result.task.id));
      const memberRows = await db.select({ id: users.id, name: users.name, email: users.email }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, result.project.workspaceId));
      const mentionedUserIds = extractMentionedUserIds(input.body, memberRows);
      const mentioned = new Set(mentionedUserIds);
      const commentRecipients = [...taskAssigneeRows.map(row => row.userId), result.task.createdById].filter(userId => !mentioned.has(userId));
      await notifyUsers({ workspaceId: result.project.workspaceId, taskId: result.task.id, actorId: ctx.user.id, type: "commented", recipientIds: commentRecipients });
      await notifyUsers({ workspaceId: result.project.workspaceId, taskId: result.task.id, actorId: ctx.user.id, type: "mentioned", recipientIds: mentionedUserIds });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "comment_added" });
      return { id: commentId, body: input.body, createdAt: new Date(), authorId: ctx.user.id, authorName: ctx.user.name, mentionedUserIds };
    }),
  }),
  attachment: router({
    presign: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), byteSize: z.number().int().min(1).max(50 * 1024 * 1024) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const presigned = await storagePresignPutUrl(`tasknest/${result.project.workspaceId}/tasks/${input.taskId}/${safeFileName}`);
      return { key: presigned.key, uploadUrl: presigned.uploadUrl, storageUrl: presigned.url };
    }),
    register: protectedProcedure.input(z.object({ taskId: z.number().int().positive(), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), byteSize: z.number().int().min(1).max(50 * 1024 * 1024), storageKey: z.string().trim().min(1).max(512) })).mutation(async ({ ctx, input }) => {
      const result = await assertTaskMember(input.taskId, ctx.user.id);
      const db = await requireDb();
      const storageUrl = `/manus-storage/${input.storageKey}`;
      const created = await db.insert(attachments).values({ taskId: input.taskId, uploadedById: ctx.user.id, fileName: input.fileName, contentType: input.contentType, byteSize: input.byteSize, storageKey: input.storageKey, storageUrl });
      await logActivity({ workspaceId: result.project.workspaceId, projectId: result.project.id, taskId: input.taskId, actorId: ctx.user.id, type: "attachment_added", metadata: { fileName: input.fileName } });
      return { id: Number(created[0].insertId), key: input.storageKey, url: storageUrl };
    }),
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
