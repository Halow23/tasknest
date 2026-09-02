/**
 * TaskNest tRPC router — fully ported to Firestore + Cloudinary.
 * Preserves the exact same procedure names, input schemas, and return shapes.
 * All data access is mediated through the firestore/ and storage.ts helpers.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";
import {
  db,
  getDoc,
  getDocs,
  invitesCol,
  labelsCol,
  projectsCol,
  tasksCol,
  templatesCol,
  automationRulesCol,
  timeEntriesCol,
  toDate,
  toDateOrNull,
  usersCol,
  workspaceDoc,
  workspacesCol,
} from "../firestore/db";
import {
  assertProjectMember,
  assertWorkspaceMember,
  createInvite,
  createNotification,
  createWorkspace,
  getActiveProjects,
  getInviteByToken,
  getNotificationsForUser,
  getProjectById,
  getWorkspaceById,
  getWorkspaceForUser,
  getWorkspaceMember,
  markNotificationsRead,
} from "../firestore/workspace";
import {
  addSubtask,
  assertTaskMember,
  createAttachment,
  createComment,
  createLabel,
  createTask,
  createTimeEntry,
  deleteLabel,
  deleteSubtask,
  deleteTimeEntry,
  getLabels,
  getOpenDependencies,
  getTaskById,
  getTaskDetail,
  listDeletedTasks,
  listTasks,
  logActivity,
  restoreTask,
  searchTasks,
  softDeleteTask,
  toggleSubtask,
  updateLabel,
  updateTask,
} from "../firestore/task";
import type {
  AutomationRuleDoc,
  AutomationTrigger,
  EmbeddedSubtask,
  LabelDoc,
  ProjectDoc,
  ProjectField,
  ProjectFieldType,
  TaskDoc,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  TemplateDoc,
  UserDoc,
  WorkspaceDoc,
} from "../firestore/types";
import { sendWorkspaceInvitationEmail } from "../invitationEmail";
import { publishWorkspaceEvent } from "../events";
import { storagePresignPutUrl, storagePut, storageGetUrl } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

// ── Validation schemas ───────────────────────────────────────────────────────

const taskStatusSchema = z.enum(["backlog", "progress", "review", "done"]);
const taskPrioritySchema = z.enum(["high", "medium", "low"]);
const projectFieldTypeSchema = z.enum(["text", "select", "date"]);
const taskRecurrenceSchema = z.enum(["none", "daily", "weekly", "monthly"]);
const fieldOptionsSchema = z.array(z.string().trim().min(1).max(80)).min(1).max(20);
const fieldValueInputSchema = z.object({ fieldId: z.string().min(1), value: z.string().trim().max(2000) });
const labelColorSchema = z.string().regex(/^#[A-Fa-f0-9]{6}$/);

const workspaceInput = z.object({ workspaceId: z.string().min(1) });
const workspaceInviteInput = workspaceInput.extend({ recipientEmail: z.string().trim().email().max(320) });
const projectInput = z.object({ projectId: z.string().min(1) });
const taskInput = z.object({ taskId: z.string().min(1) });

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// ── Helper functions ─────────────────────────────────────────────────────────

function resolveFieldValues(
  fields: ProjectField[],
  fieldValues?: { fieldId: string; value: string }[],
): Record<string, string> {
  const entries = fieldValues?.filter((entry) => entry.value.length > 0) ?? [];
  if (entries.length === 0) return {};
  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const result: Record<string, string> = {};
  for (const entry of entries) {
    const field = fieldsById.get(entry.fieldId);
    if (!field) throw new TRPCError({ code: "FORBIDDEN", message: "Custom fields must belong to the task's project." });
    if (field.type === "select") {
      const options = field.options ?? [];
      if (!options.includes(entry.value)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `“${entry.value}” is not an option for ${field.name}.` });
      }
    } else if (field.type === "date" && !isValidIsoDate(entry.value)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${field.name} requires a valid date (YYYY-MM-DD).` });
    }
    result[field.id] = entry.value;
  }
  return result;
}

function resolveLabelMap(
  allLabels: LabelDoc[],
  selectedIds?: string[],
): { ids: string[]; names: Record<string, string>; colors: Record<string, string> } {
  const ids = Array.from(new Set(selectedIds ?? []));
  const labelsById = new Map(allLabels.map((l) => [l.id, l]));
  const names: Record<string, string> = {};
  const colors: Record<string, string> = {};
  for (const id of ids) {
    const label = labelsById.get(id);
    if (label) {
      names[id] = label.name;
      colors[id] = label.color;
    }
  }
  return { ids, names, colors };
}

function advanceDueDate(base: Date | null, rule: TaskRecurrence, completedAt: Date): Date | null {
  if (rule === "none") return null;
  const from = base ?? completedAt;
  const next = new Date(from);
  if (rule === "daily") next.setDate(next.getDate() + 1);
  if (rule === "weekly") next.setDate(next.getDate() + 7);
  if (rule === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}

async function spawnRecurringTask(task: TaskDoc, wsId: string, completedAt: Date): Promise<string | null> {
  if (task.recurrenceRule === "none") return null;
  const nextDue = advanceDueDate(task.dueAt, task.recurrenceRule, completedAt);
  const nextTask = await createTask({
    wsId,
    projectId: task.projectId,
    title: task.title,
    description: task.description ?? undefined,
    priority: task.priority,
    recurrenceRule: task.recurrenceRule,
    dueAt: nextDue,
    createdById: task.createdById,
    assigneeIds: task.assigneeIds,
    assigneeNames: task.assigneeNames,
    labelIds: task.labelIds,
    labelNames: task.labelNames,
    labelColors: task.labelColors,
    fieldValues: task.fieldValues,
  });
  // Copy subtasks (uncompleted)
  for (const s of task.subtasks) {
    await addSubtask(wsId, nextTask.id, s.title);
  }
  await logActivity({
    wsId,
    projectId: task.projectId,
    taskId: nextTask.id,
    actorId: task.createdById,
    type: "task_created",
    metadata: { action: "recurrence_spawned", sourceTaskId: task.id, recurrenceRule: task.recurrenceRule },
  });
  return nextTask.id;
}

export function extractMentionedUserIds(
  body: string,
  members: { id: string; name: string | null; email: string | null }[],
): string[] {
  const mentioned: string[] = [];
  for (const member of members) {
    const candidates = [member.name, member.name?.split(/\s+/)[0], member.email?.split("@")[0]]
      .filter((value): value is string => Boolean(value && value.length >= 2));
    const matched = candidates.some((candidate) => {
      const escaped = candidate.replace(/[.*+?^$(){}[\]\\]/g, "\\$&");
      const pattern = new RegExp("@" + escaped + "(?![A-Za-z0-9._-])", "i");
      return pattern.test(body);
    });
    if (matched) mentioned.push(member.id);
  }
  return mentioned;
}

async function runAutomationsForEvent(input: {
  wsId: string;
  type: string;
  actorId: string;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (input.actorId === "system-cron" || input.metadata?.source === "automation") return;
  const trigger = input.type as AutomationTrigger;
  const automationTriggers: AutomationTrigger[] = ["task_created", "task_completed", "comment_added"];
  if (!automationTriggers.includes(trigger) || !input.taskId) return;
  try {
    const fs = db();
    const snap = await automationRulesCol(fs, input.wsId)
      .where("trigger", "==", trigger)
      .where("enabled", "==", true)
      .get();
    const task = await getTaskById(input.wsId, input.taskId);
    if (!task || task.deletedAt) return;

    for (const d of snap.docs) {
      const rule = { id: d.id, ...d.data() } as AutomationRuleDoc;
      if (rule.action === "assign_user") {
        const uid = rule.action;
        await updateTask(input.wsId, task.id, { assigneeIds: [uid] });
      } else if (rule.action === "set_priority") {
        const p = taskPrioritySchema.safeParse(rule.action);
        if (p.success) await updateTask(input.wsId, task.id, { priority: p.data });
      } else if (rule.action === "move_status") {
        const s = taskStatusSchema.safeParse(rule.action);
        if (s.success) await updateTask(input.wsId, task.id, { status: s.data });
      }
    }
  } catch {
    // Automations are best-effort
  }
}

// ── tRPC Router ───────────────────────────────────────────────────────────────

export const tasknestRouter = router({
  workspace: router({
    current: protectedProcedure.query(async ({ ctx }) => {
      const ws = await getWorkspaceForUser(ctx.user.id);
      if (!ws) return { workspace: null, members: [], projects: [], labels: [], archivedProjects: [] };
      const fs = db();
      const [allProjects, labels] = await Promise.all([
        getDocs<ProjectDoc>(projectsCol(fs, ws.id).where("deletedAt", "==", null)),
        getLabels(ws.id),
      ]);
      const availableProjects = allProjects.filter((p) => !p.archived);
      const archivedProjects = allProjects.filter((p) => p.archived);
      return { workspace: ws, members: ws.members, projects: availableProjects, labels, archivedProjects };
    }),

    create: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getWorkspaceForUser(ctx.user.id);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "You already belong to a TaskNest workspace." });
        const ws = await createWorkspace({
          name: input.name,
          ownerId: ctx.user.id,
          ownerName: ctx.user.name,
          ownerEmail: ctx.user.email,
        });
        await logActivity({ wsId: ws.id, taskId: null, projectId: null, actorId: ctx.user.id, type: "member_joined", metadata: { action: "workspace_created" } });
        return ws;
      }),

    createInvite: protectedProcedure
      .input(workspaceInviteInput)
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const token = crypto.randomUUID().replace(/-/g, "");
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
        const invite = await createInvite({
          workspaceId: input.workspaceId,
          token,
          createdById: ctx.user.id,
          recipientEmail: input.recipientEmail.toLowerCase(),
          expiresAt,
        });
        return { id: invite.id, token, recipientEmail: invite.recipientEmail, expiresAt };
      }),

    pendingInvites: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const nowTs = Timestamp.now();
        const snap = await invitesCol(fs, input.workspaceId)
          .where("acceptedAt", "==", null)
          .where("revokedAt", "==", null)
          .where("expiresAt", ">", nowTs)
          .orderBy("createdAt", "desc")
          .limit(100)
          .get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }),

    revokeInvite: protectedProcedure
      .input(z.object({ inviteId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await invitesCol(fs, input.workspaceId).doc(input.inviteId).update({ revokedAt: Timestamp.now() });
        return { revokedInviteId: input.inviteId };
      }),

    sendInviteEmail: protectedProcedure
      .input(z.object({ inviteId: z.string().min(1), workspaceId: z.string().min(1), appOrigin: z.string().url().max(500) }))
      .mutation(async ({ ctx, input }) => {
        const ws = await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const snap = await invitesCol(fs, input.workspaceId).doc(input.inviteId).get();
        if (!snap.exists) throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found." });
        const inv = snap.data() as { recipientEmail: string | null; token: string; expiresAt: Timestamp; acceptedAt: unknown; revokedAt: unknown };
        if (!inv.recipientEmail || inv.acceptedAt || inv.revokedAt || inv.expiresAt.toDate().getTime() <= Date.now()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only active invitations with a recipient email can be delivered." });
        }
        const appOrigin = new URL(input.appOrigin);
        const emailId = await sendWorkspaceInvitationEmail({
          recipientEmail: inv.recipientEmail,
          workspaceName: ws.name,
          inviteUrl: `${appOrigin.origin}/?invite=${inv.token}`,
          expiresAt: inv.expiresAt.toDate(),
        });
        return { inviteId: input.inviteId, emailId };
      }),

    acceptInvite: protectedProcedure
      .input(z.object({ token: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const invite = await getInviteByToken(input.token);
        if (!invite || invite.acceptedAt || invite.revokedAt || invite.expiresAt.getTime() < Date.now()) {
          throw new TRPCError({ code: "NOT_FOUND", message: "This invitation is unavailable or has expired." });
        }
        if (invite.recipientEmail && invite.recipientEmail.toLowerCase() !== (ctx.user.email || "").toLowerCase()) {
          throw new TRPCError({ code: "FORBIDDEN", message: "This invitation was issued for a different email address." });
        }
        const { addWorkspaceMember, acceptInvite } = await import("../firestore/workspace");
        await addWorkspaceMember(invite.workspaceId, { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email, role: "user" });
        await acceptInvite(invite.id, invite.workspaceId, ctx.user.id);
        await logActivity({ wsId: invite.workspaceId, taskId: null, projectId: null, actorId: ctx.user.id, type: "member_joined", metadata: { action: "invite_accepted" } });
        return { workspaceId: invite.workspaceId };
      }),
  }),

  project: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        return getActiveProjects(input.workspaceId);
      }),

    create: protectedProcedure
      .input(z.object({
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(120),
        color: z.string().regex(/^#[A-Fa-f0-9]{6}$/).default("#38A9F2"),
        description: z.string().trim().max(2000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const ref = projectsCol(fs, input.workspaceId).doc();
        const now = Timestamp.now();
        const data: Omit<ProjectDoc, "id"> = {
          workspaceId: input.workspaceId,
          name: input.name,
          color: input.color,
          description: input.description ?? null,
          archived: false,
          deletedAt: null,
          createdById: ctx.user.id,
          fields: [],
          createdAt: now.toDate(),
          updatedAt: now.toDate(),
        };
        await ref.set({ ...data, createdAt: now, updatedAt: now });
        return { id: ref.id, ...data };
      }),

    update: protectedProcedure
      .input(z.object({
        projectId: z.string().min(1),
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(2000).nullable().optional(),
        color: z.string().regex(/^#[A-Fa-f0-9]{6}$/).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const ref = projectsCol(fs, input.workspaceId).doc(input.projectId);
        const updates: Record<string, unknown> = { updatedAt: Timestamp.now() };
        if (input.name !== undefined) updates.name = input.name;
        if (input.description !== undefined) updates.description = input.description;
        if (input.color !== undefined) updates.color = input.color;
        await ref.update(updates);
        return getProjectById(input.workspaceId, input.projectId);
      }),

    delete: protectedProcedure
      .input(z.object({
        projectId: z.string().min(1),
        workspaceId: z.string().min(1),
        confirmation: z.string().trim().min(1).max(120),
      }))
      .mutation(async ({ ctx, input }) => {
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        if (input.confirmation !== proj.name) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the exact project name to delete it." });
        }
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ deletedAt: Timestamp.now() });
        await logActivity({ wsId: input.workspaceId, projectId: input.projectId, taskId: null, actorId: ctx.user.id, type: "task_updated", metadata: { action: "project_deleted", projectName: proj.name } });
        return { deletedProjectId: input.projectId };
      }),

    restore: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ deletedAt: null });
        return { restoredProjectId: input.projectId };
      }),

    archive: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ archived: true });
        return { archivedProjectId: input.projectId };
      }),

    unarchive: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ archived: false });
        return { unarchivedProjectId: input.projectId };
      }),
  }),

  task: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.string().min(1),
        workspaceId: z.string().min(1),
        assigneeId: z.string().nullable().optional(),
        priority: taskPrioritySchema.optional(),
        labelId: z.string().nullable().optional(),
        dueBucket: z.enum(["overdue", "today", "week", "none"]).optional(),
      }))
      .query(async ({ ctx, input }) => {
        const ws = await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj || proj.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const tasks = await listTasks({
          wsId: input.workspaceId,
          projectId: input.projectId,
          priority: input.priority,
          assigneeId: input.assigneeId ?? undefined,
          labelId: input.labelId ?? undefined,
          dueBucket: input.dueBucket,
        });
        const labels = await getLabels(input.workspaceId);
        return { tasks, assignees: ws.members, labels, project: proj };
      }),

    search: protectedProcedure
      .input(z.object({ workspaceId: z.string().min(1), query: z.string().trim().min(1).max(120), limit: z.number().int().min(1).max(30).default(15) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        return searchTasks({ wsId: input.workspaceId, query: input.query, limit: input.limit });
      }),

    export: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const tasks = await listTasks({ wsId: input.workspaceId, projectId: input.projectId });
        return {
          projectName: proj.name,
          tasks: tasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            recurrenceRule: t.recurrenceRule,
            dueAt: t.dueAt,
            completedAt: t.completedAt,
            createdAt: t.createdAt,
            assignees: Object.values(t.assigneeNames).join("; "),
            labels: Object.values(t.labelNames).join("; "),
          })),
        };
      }),

    detail: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const detail = await getTaskDetail(input.workspaceId, input.taskId);
        const openDeps = await getOpenDependencies(input.workspaceId, input.taskId);
        const proj = await getProjectById(input.workspaceId, detail.task.projectId);
        return {
          ...detail.task,
          project: proj,
          assignees: Object.entries(detail.task.assigneeNames).map(([id, name]) => ({ id, name, email: null })),
          subtasks: detail.task.subtasks,
          comments: detail.comments,
          attachments: detail.attachments.map((a) => ({ ...a, storageUrl: storageGetUrl(a.cloudinaryUrl) })),
          activity: detail.activity,
          fieldValues: Object.entries(detail.task.fieldValues).map(([fieldId, value]) => ({ fieldId, value })),
          labels: Object.entries(detail.task.labelNames).map(([id, name]) => ({ id, name, color: detail.task.labelColors[id] ?? "#38A9F2" })),
          openDependencies: openDeps,
          timeEntries: detail.timeEntries,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        workspaceId: z.string().min(1),
        projectId: z.string().min(1),
        title: z.string().trim().min(1).max(240),
        description: z.string().trim().max(8000).optional(),
        priority: taskPrioritySchema.default("medium"),
        dueAt: z.date().nullable().optional(),
        recurrenceRule: taskRecurrenceSchema.optional(),
        assigneeIds: z.array(z.string().min(1)).max(20).optional(),
        fieldValues: z.array(fieldValueInputSchema).max(30).optional(),
        labelIds: z.array(z.string().min(1)).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ws = await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj || proj.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

        const assigneeNames: Record<string, string> = {};
        for (const uid of input.assigneeIds ?? []) {
          const m = ws.members.find((member) => member.userId === uid);
          if (m) assigneeNames[uid] = m.name || m.email || "Teammate";
        }
        const allLabels = await getLabels(input.workspaceId);
        const labelMap = resolveLabelMap(allLabels, input.labelIds);
        const fieldValues = resolveFieldValues(proj.fields, input.fieldValues);

        const task = await createTask({
          wsId: input.workspaceId,
          projectId: input.projectId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          recurrenceRule: input.recurrenceRule,
          dueAt: input.dueAt,
          createdById: ctx.user.id,
          assigneeIds: input.assigneeIds,
          assigneeNames,
          labelIds: labelMap.ids,
          labelNames: labelMap.names,
          labelColors: labelMap.colors,
          fieldValues,
        });

        for (const uid of input.assigneeIds ?? []) {
          if (uid !== ctx.user.id) {
            await createNotification({
              userId: uid,
              type: "assigned",
              actorId: ctx.user.id,
              actorName: ctx.user.name || "Teammate",
              taskId: task.id,
              taskTitle: task.title,
              workspaceId: input.workspaceId,
            });
          }
        }

        await logActivity({ wsId: input.workspaceId, projectId: input.projectId, taskId: task.id, actorId: ctx.user.id, type: "task_created", metadata: { title: input.title } });
        return { taskId: task.id, projectId: input.projectId };
      }),

    update: protectedProcedure
      .input(z.object({
        taskId: z.string().min(1),
        workspaceId: z.string().min(1),
        title: z.string().trim().min(1).max(240).optional(),
        description: z.string().trim().max(8000).nullable().optional(),
        priority: taskPrioritySchema.optional(),
        dueAt: z.date().nullable().optional(),
        recurrenceRule: taskRecurrenceSchema.optional(),
        assigneeIds: z.array(z.string().min(1)).max(20).optional(),
        fieldValues: z.array(fieldValueInputSchema).max(30).optional(),
        labelIds: z.array(z.string().min(1)).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const ws = await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const existing = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        const proj = await getProjectById(input.workspaceId, existing.projectId);

        const updates: Parameters<typeof updateTask>[2] = {};
        if (input.title !== undefined) updates.title = input.title;
        if (input.description !== undefined) updates.description = input.description;
        if (input.priority !== undefined) updates.priority = input.priority;
        if (input.dueAt !== undefined) updates.dueAt = input.dueAt;
        if (input.recurrenceRule !== undefined) updates.recurrenceRule = input.recurrenceRule;

        if (input.assigneeIds !== undefined) {
          updates.assigneeIds = input.assigneeIds;
          const assigneeNames: Record<string, string> = {};
          for (const uid of input.assigneeIds) {
            const m = ws.members.find((member) => member.userId === uid);
            if (m) assigneeNames[uid] = m.name || m.email || "Teammate";
          }
          updates.assigneeNames = assigneeNames;
        }

        if (input.labelIds !== undefined) {
          const allLabels = await getLabels(input.workspaceId);
          const labelMap = resolveLabelMap(allLabels, input.labelIds);
          updates.labelIds = labelMap.ids;
          updates.labelNames = labelMap.names;
          updates.labelColors = labelMap.colors;
        }

        if (input.fieldValues !== undefined && proj) {
          updates.fieldValues = resolveFieldValues(proj.fields, input.fieldValues);
        }

        await updateTask(input.workspaceId, input.taskId, updates);
        await logActivity({ wsId: input.workspaceId, projectId: existing.projectId, taskId: input.taskId, actorId: ctx.user.id, type: "task_updated" });
        return { taskId: input.taskId, projectId: existing.projectId };
      }),

    delete: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), confirmation: z.string().trim().min(1).max(240) }))
      .mutation(async ({ ctx, input }) => {
        const task = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        if (input.confirmation !== task.title) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the exact task title to delete it." });
        }
        await softDeleteTask(input.workspaceId, input.taskId);
        await logActivity({ wsId: input.workspaceId, projectId: task.projectId, taskId: input.taskId, actorId: ctx.user.id, type: "task_updated", metadata: { action: "task_deleted", title: task.title } });
        return { deletedTaskId: input.taskId, projectId: task.projectId };
      }),

    restore: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await restoreTask(input.workspaceId, input.taskId);
        return { restoredTaskId: input.taskId };
      }),

    move: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), status: taskStatusSchema, sortOrder: z.number().int().optional() }))
      .mutation(async ({ ctx, input }) => {
        const task = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        if (input.status === "done") {
          const openDeps = await getOpenDependencies(input.workspaceId, input.taskId);
          if (openDeps.length > 0) {
            const names = openDeps.map((d) => `"${d.title}"`).join(", ");
            throw new TRPCError({ code: "BAD_REQUEST", message: `Blocked by open dependencies: ${names}. Complete them first.` });
          }
        }
        const completedAt = input.status === "done" ? new Date() : null;
        await updateTask(input.workspaceId, input.taskId, {
          status: input.status,
          sortOrder: input.sortOrder ?? Math.floor(Date.now() / 1000),
          completedAt,
        });
        let spawnedTaskId: string | null = null;
        if (input.status === "done") {
          spawnedTaskId = await spawnRecurringTask(task, input.workspaceId, completedAt!);
        }
        await logActivity({
          wsId: input.workspaceId,
          projectId: task.projectId,
          taskId: input.taskId,
          actorId: ctx.user.id,
          type: input.status === "done" ? "task_completed" : "task_moved",
          metadata: { status: input.status, ...(spawnedTaskId ? { spawnedTaskId } : {}) },
        });
        return { taskId: input.taskId, projectId: task.projectId, status: input.status, spawnedTaskId };
      }),

    reorder: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1), status: taskStatusSchema, orderedTaskIds: z.array(z.string().min(1)).min(1).max(500) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const batch = fs.batch();
        input.orderedTaskIds.forEach((id, index) => {
          batch.update(tasksCol(fs, input.workspaceId).doc(id), { sortOrder: index * 10, updatedAt: Timestamp.now() });
        });
        await batch.commit();
        return { projectId: input.projectId, status: input.status };
      }),

    myTasks: protectedProcedure.query(async ({ ctx }) => {
      const ws = await getWorkspaceForUser(ctx.user.id);
      if (!ws) return [];
      const fs = db();
      const snap = await tasksCol(fs, ws.id)
        .where("assigneeIds", "array-contains", ctx.user.id)
        .where("deletedAt", "==", null)
        .where("completedAt", "==", null)
        .orderBy("dueAt", "asc")
        .get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }),
  }),

  dependency: router({
    list: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        return getOpenDependencies(input.workspaceId, input.taskId);
      }),

    create: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), dependsOnTaskId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (input.taskId === input.dependsOnTaskId) throw new TRPCError({ code: "BAD_REQUEST", message: "A task cannot depend on itself." });
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const { addDependency } = await import("../firestore/task");
        await addDependency(input.workspaceId, input.taskId, input.dependsOnTaskId);
        return { dependencyId: input.dependsOnTaskId };
      }),

    delete: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), dependsOnTaskId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const { removeDependency } = await import("../firestore/task");
        await removeDependency(input.workspaceId, input.taskId, input.dependsOnTaskId);
        return { deletedDependencyId: input.dependsOnTaskId };
      }),
  }),

  template: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const snap = await templatesCol(db(), input.workspaceId).orderBy("name", "asc").get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }),

    create: protectedProcedure
      .input(z.object({
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(240),
        description: z.string().trim().max(8000).optional(),
        priority: taskPrioritySchema.default("medium"),
        recurrenceRule: taskRecurrenceSchema.default("none"),
        subtaskTitles: z.array(z.string().trim().min(1).max(240)).max(30).optional(),
        labelIds: z.array(z.string().min(1)).max(20).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const ref = templatesCol(fs, input.workspaceId).doc();
        const now = Timestamp.now();
        const data: Omit<TemplateDoc, "id"> = {
          workspaceId: input.workspaceId,
          name: input.name,
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          recurrenceRule: input.recurrenceRule,
          subtaskTitles: input.subtaskTitles ?? [],
          labelIds: input.labelIds ?? [],
          createdById: ctx.user.id,
          createdAt: now.toDate(),
          updatedAt: now.toDate(),
        };
        await ref.set({ ...data, createdAt: now, updatedAt: now });
        return { templateId: ref.id, name: input.name };
      }),

    delete: protectedProcedure
      .input(z.object({ templateId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await templatesCol(db(), input.workspaceId).doc(input.templateId).delete();
        return { deletedTemplateId: input.templateId };
      }),
  }),

  time: router({
    log: protectedProcedure
      .input(z.object({
        taskId: z.string().min(1),
        workspaceId: z.string().min(1),
        minutes: z.number().int().min(1).max(10_080),
        note: z.string().trim().max(240).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const entry = await createTimeEntry({
          wsId: input.workspaceId,
          taskId: input.taskId,
          userId: ctx.user.id,
          userName: ctx.user.name || "Teammate",
          minutes: input.minutes,
          note: input.note ?? null,
        });
        return { entryId: entry.id, minutes: input.minutes };
      }),

    delete: protectedProcedure
      .input(z.object({ entryId: z.string().min(1), taskId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await deleteTimeEntry(input.workspaceId, input.taskId, input.entryId);
        return { deletedEntryId: input.entryId };
      }),
  }),

  automation: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const snap = await automationRulesCol(db(), input.workspaceId).orderBy("createdAt", "asc").get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }),

    create: protectedProcedure
      .input(z.object({
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(80),
        trigger: z.enum(["task_created", "task_completed", "comment_added"]),
        action: z.enum(["assign_user", "set_priority", "move_status", "notify_user"]),
        actionValue: z.string().trim().min(1).max(240),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        const ref = automationRulesCol(fs, input.workspaceId).doc();
        const now = Timestamp.now();
        const data: Omit<AutomationRuleDoc, "id"> = {
          workspaceId: input.workspaceId,
          trigger: input.trigger as AutomationTrigger,
          action: `${input.action}:${input.actionValue}`,
          enabled: true,
          createdById: ctx.user.id,
          createdAt: now.toDate(),
          updatedAt: now.toDate(),
        };
        await ref.set({ ...data, createdAt: now, updatedAt: now });
        return { ruleId: ref.id, name: input.name };
      }),

    setEnabled: protectedProcedure
      .input(z.object({ ruleId: z.string().min(1), workspaceId: z.string().min(1), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await automationRulesCol(db(), input.workspaceId).doc(input.ruleId).update({ enabled: input.enabled, updatedAt: Timestamp.now() });
        return { ruleId: input.ruleId, enabled: input.enabled };
      }),

    delete: protectedProcedure
      .input(z.object({ ruleId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await automationRulesCol(db(), input.workspaceId).doc(input.ruleId).delete();
        return { deletedRuleId: input.ruleId };
      }),
  }),

  trash: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const [tasks, projs] = await Promise.all([
          listDeletedTasks(input.workspaceId),
          getActiveProjects(input.workspaceId), // we'll filter below
        ]);
        const fs = db();
        const delProjsSnap = await projectsCol(fs, input.workspaceId).where("deletedAt", "!=", null).limit(100).get();
        const delProjs = delProjsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        return { tasks, projects: delProjs };
      }),

    purgeTask: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await tasksCol(fs, input.workspaceId).doc(input.taskId).delete();
        return { purgedTaskId: input.taskId };
      }),

    purgeProject: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).delete();
        return { purgedProjectId: input.projectId };
      }),
  }),

  label: router({
    list: protectedProcedure
      .input(workspaceInput)
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        return getLabels(input.workspaceId);
      }),

    create: protectedProcedure
      .input(z.object({ workspaceId: z.string().min(1), name: z.string().trim().min(1).max(40), color: labelColorSchema.default("#38A9F2") }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const label = await createLabel({ wsId: input.workspaceId, name: input.name, color: input.color, createdById: ctx.user.id });
        return { labelId: label.id, name: label.name, color: label.color };
      }),

    update: protectedProcedure
      .input(z.object({ labelId: z.string().min(1), workspaceId: z.string().min(1), name: z.string().trim().min(1).max(40).optional(), color: labelColorSchema.optional() }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await updateLabel(input.workspaceId, input.labelId, { name: input.name, color: input.color });
        return { labelId: input.labelId };
      }),

    delete: protectedProcedure
      .input(z.object({ labelId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await deleteLabel(input.workspaceId, input.labelId);
        return { deletedLabelId: input.labelId };
      }),
  }),

  notification: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const notifications = await getNotificationsForUser(ctx.user.id);
      return { notifications, unreadCount: notifications.filter((n) => !n.readAt).length };
    }),

    markRead: protectedProcedure
      .input(z.object({ notificationId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await markNotificationsRead(ctx.user.id, [input.notificationId]);
        return { markedNotificationId: input.notificationId };
      }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const notifications = await getNotificationsForUser(ctx.user.id);
      const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id);
      if (unreadIds.length > 0) await markNotificationsRead(ctx.user.id, unreadIds);
      return { success: true };
    }),
  }),

  field: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        return proj?.fields ?? [];
      }),

    create: protectedProcedure
      .input(z.object({
        projectId: z.string().min(1),
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(60),
        type: projectFieldTypeSchema.default("text"),
        options: fieldOptionsSchema.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const field: ProjectField = {
          id: nanoid(),
          name: input.name,
          type: input.type as ProjectFieldType,
          options: input.type === "select" ? input.options ?? null : null,
          sortOrder: proj.fields.length * 10,
          createdById: ctx.user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const fs = db();
        const { FieldValue } = await import("firebase-admin/firestore");
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({
          fields: FieldValue.arrayUnion({ ...field, createdAt: Timestamp.fromDate(field.createdAt), updatedAt: Timestamp.fromDate(field.updatedAt) }),
          updatedAt: Timestamp.now(),
        });
        return { fieldId: field.id, projectId: input.projectId };
      }),

    update: protectedProcedure
      .input(z.object({
        fieldId: z.string().min(1),
        projectId: z.string().min(1),
        workspaceId: z.string().min(1),
        name: z.string().trim().min(1).max(60).optional(),
        options: fieldOptionsSchema.optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const fields = proj.fields.map((f) => {
          if (f.id !== input.fieldId) return { ...f, createdAt: Timestamp.fromDate(f.createdAt), updatedAt: Timestamp.fromDate(f.updatedAt) };
          return {
            ...f,
            name: input.name ?? f.name,
            options: input.options ?? f.options,
            createdAt: Timestamp.fromDate(f.createdAt),
            updatedAt: Timestamp.now(),
          };
        });
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ fields, updatedAt: Timestamp.now() });
        return { fieldId: input.fieldId };
      }),

    delete: protectedProcedure
      .input(z.object({ fieldId: z.string().min(1), projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const proj = await getProjectById(input.workspaceId, input.projectId);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
        const fields = proj.fields
          .filter((f) => f.id !== input.fieldId)
          .map((f) => ({ ...f, createdAt: Timestamp.fromDate(f.createdAt), updatedAt: Timestamp.fromDate(f.updatedAt) }));
        const fs = db();
        await projectsCol(fs, input.workspaceId).doc(input.projectId).update({ fields, updatedAt: Timestamp.now() });
        return { deletedFieldId: input.fieldId };
      }),
  }),

  subtask: router({
    create: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), title: z.string().trim().min(1).max(240) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const subtask = await addSubtask(input.workspaceId, input.taskId, input.title);
        return { id: subtask.id };
      }),

    toggle: protectedProcedure
      .input(z.object({ subtaskId: z.string().min(1), taskId: z.string().min(1), workspaceId: z.string().min(1), completed: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        await toggleSubtask(input.workspaceId, input.taskId, input.subtaskId, input.completed);
        return { success: true };
      }),
  }),

  comment: router({
    create: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), body: z.string().trim().min(1).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        const ws = await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const task = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        const comment = await createComment({
          wsId: input.workspaceId,
          taskId: input.taskId,
          authorId: ctx.user.id,
          authorName: ctx.user.name || "Teammate",
          body: input.body,
        });
        const mentionedUserIds = extractMentionedUserIds(input.body, ws.members.map((m) => ({ id: m.userId, name: m.name, email: m.email })));
        const mentioned = new Set(mentionedUserIds);
        const recipients = Array.from(new Set([...task.assigneeIds, task.createdById])).filter((id) => !mentioned.has(id) && id !== ctx.user.id);

        for (const uid of recipients) {
          await createNotification({ userId: uid, type: "commented", actorId: ctx.user.id, actorName: ctx.user.name || "Teammate", taskId: task.id, taskTitle: task.title, workspaceId: input.workspaceId });
        }
        for (const uid of mentionedUserIds) {
          if (uid !== ctx.user.id) {
            await createNotification({ userId: uid, type: "mentioned", actorId: ctx.user.id, actorName: ctx.user.name || "Teammate", taskId: task.id, taskTitle: task.title, workspaceId: input.workspaceId });
          }
        }
        await logActivity({ wsId: input.workspaceId, projectId: task.projectId, taskId: input.taskId, actorId: ctx.user.id, type: "comment_added" });
        return { id: comment.id, body: input.body, createdAt: comment.createdAt, authorId: ctx.user.id, authorName: ctx.user.name, mentionedUserIds };
      }),
  }),

  attachment: router({
    presign: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), byteSize: z.number().int().min(1).max(50 * 1024 * 1024) }))
      .mutation(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const presigned = await storagePresignPutUrl(`tasknest/${input.workspaceId}/tasks/${input.taskId}/${safeFileName}`, input.contentType);
        return { key: presigned.key, uploadUrl: presigned.uploadUrl, uploadParams: presigned.uploadParams };
      }),

    register: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), byteSize: z.number().int().min(1).max(50 * 1024 * 1024), storageKey: z.string().trim().min(1).max(512), cloudinaryUrl: z.string().url().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const task = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        const attach = await createAttachment({
          wsId: input.workspaceId,
          taskId: input.taskId,
          uploadedById: ctx.user.id,
          fileName: input.fileName,
          contentType: input.contentType,
          byteSize: input.byteSize,
          cloudinaryPublicId: input.storageKey,
          cloudinaryUrl: input.cloudinaryUrl,
        });
        await logActivity({ wsId: input.workspaceId, projectId: task.projectId, taskId: input.taskId, actorId: ctx.user.id, type: "attachment_added", metadata: { fileName: input.fileName } });
        return { id: attach.id, key: input.storageKey };
      }),

    upload: protectedProcedure
      .input(z.object({ taskId: z.string().min(1), workspaceId: z.string().min(1), fileName: z.string().trim().min(1).max(240), contentType: z.string().trim().min(3).max(120), dataBase64: z.string().min(1).max(7_000_000) }))
      .mutation(async ({ ctx, input }) => {
        const task = await assertTaskMember(input.taskId, ctx.user.id, input.workspaceId);
        const bytes = Buffer.from(input.dataBase64.replace(/^data:[^,]+,/, ""), "base64");
        if (bytes.byteLength === 0 || bytes.byteLength > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachments must be smaller than 5 MB." });
        const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const stored = await storagePut(`tasknest/${input.workspaceId}/tasks/${input.taskId}/${safeFileName}`, bytes, input.contentType);
        const attach = await createAttachment({
          wsId: input.workspaceId,
          taskId: input.taskId,
          uploadedById: ctx.user.id,
          fileName: input.fileName,
          contentType: input.contentType,
          byteSize: bytes.byteLength,
          cloudinaryPublicId: stored.key,
          cloudinaryUrl: stored.url,
        });
        await logActivity({ wsId: input.workspaceId, projectId: task.projectId, taskId: input.taskId, actorId: ctx.user.id, type: "attachment_added", metadata: { fileName: input.fileName } });
        return { id: attach.id, key: stored.key, url: stored.url };
      }),
  }),

  analytics: router({
    project: protectedProcedure
      .input(z.object({ projectId: z.string().min(1), workspaceId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await assertWorkspaceMember(input.workspaceId, ctx.user.id);
        const tasks = await listTasks({ wsId: input.workspaceId, projectId: input.projectId });
        const today = new Date();
        const upcoming = new Date(today);
        upcoming.setDate(today.getDate() + 7);
        const byStatus: Record<TaskStatus, number> = { backlog: 0, progress: 0, review: 0, done: 0 };
        for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
        const total = tasks.length;
        const dueThisWeek = tasks.filter((t) => t.dueAt && t.dueAt >= today && t.dueAt <= upcoming && t.status !== "done").length;
        const overdue = tasks.filter((t) => t.dueAt && t.dueAt < today && t.status !== "done").length;
        return { total, dueThisWeek, overdue, completionRate: total ? Math.round((byStatus.done / total) * 100) : 0, byStatus };
      }),
  }),
});
