/**
 * Task CRUD and query helpers backed by Firestore.
 * Denormalization strategy: assigneeIds/Names, labelIds/Names/Colors,
 * fieldValues, dependencies, and subtasks are all embedded in the task doc.
 * Comments, attachments, activity, and time entries are subcollections.
 */

import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  activityCol,
  attachmentsCol,
  commentsCol,
  db,
  getDoc,
  getDocs,
  labelsCol,
  newId,
  tasksCol,
  timeEntriesCol,
  toDate,
  toDateOrNull,
} from "./db";
import type {
  ActivityDoc,
  ActivityEventType,
  AttachmentDoc,
  CommentDoc,
  EmbeddedSubtask,
  LabelDoc,
  ProjectField,
  TaskDoc,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
  TimeEntryDoc,
} from "./types";

// ── Converters ───────────────────────────────────────────────────────────────

function toTask(id: string, raw: Record<string, unknown>): TaskDoc {
  const rawSubtasks = (raw.subtasks as Record<string, unknown>[] | undefined) ?? [];
  return {
    id,
    workspaceId: raw.workspaceId as string,
    projectId: raw.projectId as string,
    title: raw.title as string,
    titleLower: (raw.titleLower as string) ?? (raw.title as string ?? "").toLowerCase(),
    description: (raw.description as string | null) ?? null,
    status: (raw.status as TaskStatus) ?? "backlog",
    priority: (raw.priority as TaskPriority) ?? "medium",
    recurrenceRule: (raw.recurrenceRule as TaskRecurrence) ?? "none",
    dueAt: toDateOrNull(raw.dueAt),
    sortOrder: (raw.sortOrder as number) ?? 0,
    completedAt: toDateOrNull(raw.completedAt),
    deletedAt: toDateOrNull(raw.deletedAt),
    createdById: raw.createdById as string,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
    assigneeIds: (raw.assigneeIds as string[]) ?? [],
    assigneeNames: (raw.assigneeNames as Record<string, string>) ?? {},
    labelIds: (raw.labelIds as string[]) ?? [],
    labelNames: (raw.labelNames as Record<string, string>) ?? {},
    labelColors: (raw.labelColors as Record<string, string>) ?? {},
    fieldValues: (raw.fieldValues as Record<string, string>) ?? {},
    dependencies: (raw.dependencies as string[]) ?? [],
    subtasks: rawSubtasks.map((s) => ({
      id: s.id as string,
      title: s.title as string,
      completed: (s.completed as boolean) ?? false,
      sortOrder: (s.sortOrder as number) ?? 0,
      createdAt: toDate(s.createdAt),
    })),
  };
}

function toComment(id: string, raw: Record<string, unknown>): CommentDoc {
  return {
    id,
    taskId: raw.taskId as string,
    workspaceId: raw.workspaceId as string,
    authorId: raw.authorId as string,
    authorName: (raw.authorName as string) ?? "",
    body: raw.body as string,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

function toAttachment(id: string, raw: Record<string, unknown>): AttachmentDoc {
  return {
    id,
    taskId: raw.taskId as string,
    workspaceId: raw.workspaceId as string,
    uploadedById: raw.uploadedById as string,
    fileName: raw.fileName as string,
    contentType: raw.contentType as string,
    byteSize: raw.byteSize as number,
    cloudinaryPublicId: raw.cloudinaryPublicId as string,
    cloudinaryUrl: raw.cloudinaryUrl as string,
    createdAt: toDate(raw.createdAt),
  };
}

function toActivity(id: string, raw: Record<string, unknown>): ActivityDoc {
  return {
    id,
    taskId: (raw.taskId as string | null) ?? null,
    projectId: (raw.projectId as string | null) ?? null,
    workspaceId: raw.workspaceId as string,
    actorId: raw.actorId as string,
    type: raw.type as ActivityEventType,
    metadata: (raw.metadata as Record<string, unknown> | null) ?? null,
    createdAt: toDate(raw.createdAt),
  };
}

function toTimeEntry(id: string, raw: Record<string, unknown>): TimeEntryDoc {
  return {
    id,
    taskId: raw.taskId as string,
    workspaceId: raw.workspaceId as string,
    userId: raw.userId as string,
    userName: (raw.userName as string) ?? "",
    minutes: raw.minutes as number,
    note: (raw.note as string | null) ?? null,
    loggedAt: toDate(raw.loggedAt),
  };
}

// ── Task read helpers ────────────────────────────────────────────────────────

export async function getTaskById(wsId: string, taskId: string): Promise<TaskDoc | null> {
  const fs = db();
  const snap = await tasksCol(fs, wsId).doc(taskId).get();
  if (!snap.exists) return null;
  return toTask(snap.id, snap.data() as Record<string, unknown>);
}

export async function assertTaskMember(
  taskId: string,
  uid: string,
  wsId: string,
): Promise<TaskDoc> {
  const task = await getTaskById(wsId, taskId);
  if (!task || task.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  return task;
}

export async function listTasks(input: {
  wsId: string;
  projectId: string;
  priority?: TaskPriority;
  assigneeId?: string;
  labelId?: string;
  dueBucket?: "overdue" | "today" | "week" | "none";
}): Promise<TaskDoc[]> {
  const fs = db();
  let query = tasksCol(fs, input.wsId)
    .where("projectId", "==", input.projectId)
    .where("deletedAt", "==", null);

  if (input.priority) query = query.where("priority", "==", input.priority) as typeof query;
  if (input.assigneeId) query = query.where("assigneeIds", "array-contains", input.assigneeId) as typeof query;
  if (input.labelId) query = query.where("labelIds", "array-contains", input.labelId) as typeof query;

  query = query.orderBy("sortOrder", "asc").orderBy("updatedAt", "desc") as typeof query;

  const snap = await query.get();
  let tasks = snap.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));

  // Due-date filtering applied in-process (Firestore inequality filters require composite indexes)
  if (input.dueBucket) {
    const now = new Date();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const endOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    tasks = tasks.filter((t) => {
      if (input.dueBucket === "none") return !t.dueAt;
      if (input.dueBucket === "overdue") return t.dueAt && t.dueAt < now && !t.completedAt;
      if (input.dueBucket === "today") return t.dueAt && t.dueAt >= now && t.dueAt < endOfToday;
      if (input.dueBucket === "week") return t.dueAt && t.dueAt >= now && t.dueAt < endOfWeek;
      return true;
    });
  }

  return tasks;
}

export async function getTaskDetail(wsId: string, taskId: string) {
  const fs = db();
  const task = await getTaskById(wsId, taskId);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });

  const [comments, attachments, activity, timeEntries] = await Promise.all([
    getDocs<CommentDoc>(commentsCol(fs, wsId, taskId).orderBy("createdAt", "asc")),
    getDocs<AttachmentDoc>(attachmentsCol(fs, wsId, taskId).orderBy("createdAt", "desc")),
    getDocs<ActivityDoc>(activityCol(fs, wsId, taskId).orderBy("createdAt", "desc").limit(50)),
    getDocs<TimeEntryDoc>(timeEntriesCol(fs, wsId, taskId).orderBy("loggedAt", "desc")),
  ]);

  return {
    task,
    comments: comments.map((c) => toComment(c.id, c as unknown as Record<string, unknown>)),
    attachments: attachments.map((a) => toAttachment(a.id, a as unknown as Record<string, unknown>)),
    activity: activity.map((a) => toActivity(a.id, a as unknown as Record<string, unknown>)),
    timeEntries: timeEntries.map((e) => toTimeEntry(e.id, e as unknown as Record<string, unknown>)),
  };
}

/** Search tasks by title prefix or comment body (trigram fallback). */
export async function searchTasks(input: {
  wsId: string;
  query: string;
  limit: number;
}): Promise<TaskDoc[]> {
  const fs = db();
  const q = input.query.toLowerCase().trim();
  // Prefix search on titleLower
  const snap = await tasksCol(fs, input.wsId)
    .where("deletedAt", "==", null)
    .where("titleLower", ">=", q)
    .where("titleLower", "<=", q + "\uf8ff")
    .orderBy("titleLower", "asc")
    .limit(input.limit)
    .get();
  return snap.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
}

// ── Task write helpers ───────────────────────────────────────────────────────

export async function createTask(input: {
  wsId: string;
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  recurrenceRule?: TaskRecurrence;
  dueAt?: Date | null;
  createdById: string;
  assigneeIds?: string[];
  assigneeNames?: Record<string, string>;
  labelIds?: string[];
  labelNames?: Record<string, string>;
  labelColors?: Record<string, string>;
  fieldValues?: Record<string, string>;
}): Promise<TaskDoc> {
  const fs = db();
  const ref = tasksCol(fs, input.wsId).doc();
  const now = Timestamp.now();
  const data = {
    workspaceId: input.wsId,
    projectId: input.projectId,
    title: input.title,
    titleLower: input.title.toLowerCase(),
    description: input.description ?? null,
    status: "backlog" as TaskStatus,
    priority: input.priority,
    recurrenceRule: input.recurrenceRule ?? "none",
    dueAt: input.dueAt ? Timestamp.fromDate(input.dueAt) : null,
    sortOrder: Math.floor(Date.now() / 1000),
    completedAt: null,
    deletedAt: null,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
    assigneeIds: input.assigneeIds ?? [],
    assigneeNames: input.assigneeNames ?? {},
    labelIds: input.labelIds ?? [],
    labelNames: input.labelNames ?? {},
    labelColors: input.labelColors ?? {},
    fieldValues: input.fieldValues ?? {},
    dependencies: [],
    subtasks: [],
  };
  await ref.set(data);
  return toTask(ref.id, data as unknown as Record<string, unknown>);
}

export async function updateTask(
  wsId: string,
  taskId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    recurrenceRule: TaskRecurrence;
    dueAt: Date | null;
    completedAt: Date | null;
    deletedAt: Date | null;
    assigneeIds: string[];
    assigneeNames: Record<string, string>;
    labelIds: string[];
    labelNames: Record<string, string>;
    labelColors: Record<string, string>;
    fieldValues: Record<string, string>;
  }>,
): Promise<void> {
  const fs = db();
  const ref = tasksCol(fs, wsId).doc(taskId);
  const payload: Record<string, unknown> = { updatedAt: Timestamp.now() };
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    if (key === "title") {
      payload.title = value;
      payload.titleLower = (value as string).toLowerCase();
    } else if (value instanceof Date) {
      payload[key] = Timestamp.fromDate(value);
    } else {
      payload[key] = value;
    }
  }
  await ref.update(payload);
}

// ── Subtasks (embedded array) ────────────────────────────────────────────────

export async function addSubtask(wsId: string, taskId: string, title: string): Promise<EmbeddedSubtask> {
  const fs = db();
  const subtask: EmbeddedSubtask = {
    id: nanoid(),
    title,
    completed: false,
    sortOrder: Math.floor(Date.now() / 1000),
    createdAt: new Date(),
  };
  await tasksCol(fs, wsId).doc(taskId).update({
    subtasks: FieldValue.arrayUnion({ ...subtask, createdAt: Timestamp.fromDate(subtask.createdAt) }),
    updatedAt: Timestamp.now(),
  });
  return subtask;
}

export async function toggleSubtask(wsId: string, taskId: string, subtaskId: string, completed: boolean): Promise<void> {
  const task = await getTaskById(wsId, taskId);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  const fs = db();
  const updated = task.subtasks.map((s) =>
    s.id === subtaskId ? { ...s, completed, createdAt: Timestamp.fromDate(s.createdAt) } : { ...s, createdAt: Timestamp.fromDate(s.createdAt) },
  );
  await tasksCol(fs, wsId).doc(taskId).update({ subtasks: updated, updatedAt: Timestamp.now() });
}

export async function deleteSubtask(wsId: string, taskId: string, subtaskId: string): Promise<void> {
  const task = await getTaskById(wsId, taskId);
  if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
  const fs = db();
  const updated = task.subtasks
    .filter((s) => s.id !== subtaskId)
    .map((s) => ({ ...s, createdAt: Timestamp.fromDate(s.createdAt) }));
  await tasksCol(fs, wsId).doc(taskId).update({ subtasks: updated, updatedAt: Timestamp.now() });
}

// ── Comments ─────────────────────────────────────────────────────────────────

export async function createComment(input: {
  wsId: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
}): Promise<CommentDoc> {
  const fs = db();
  const ref = commentsCol(fs, input.wsId, input.taskId).doc();
  const now = Timestamp.now();
  const data = {
    taskId: input.taskId,
    workspaceId: input.wsId,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return toComment(ref.id, data as unknown as Record<string, unknown>);
}

// ── Attachments ───────────────────────────────────────────────────────────────

export async function createAttachment(input: {
  wsId: string;
  taskId: string;
  uploadedById: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  cloudinaryPublicId: string;
  cloudinaryUrl: string;
}): Promise<AttachmentDoc> {
  const fs = db();
  const ref = attachmentsCol(fs, input.wsId, input.taskId).doc();
  const now = Timestamp.now();
  const data = { ...input, createdAt: now };
  await ref.set(data);
  return toAttachment(ref.id, data as unknown as Record<string, unknown>);
}

// ── Activity log ──────────────────────────────────────────────────────────────

export async function logActivity(input: {
  wsId: string;
  taskId: string | null;
  projectId: string | null;
  actorId: string;
  type: ActivityEventType;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const fs = db();
  if (!input.taskId) return; // workspace-level events not stored per-task
  const ref = activityCol(fs, input.wsId, input.taskId).doc();
  await ref.set({
    taskId: input.taskId,
    projectId: input.projectId,
    workspaceId: input.wsId,
    actorId: input.actorId,
    type: input.type,
    metadata: input.metadata ?? null,
    createdAt: Timestamp.now(),
  });
}

// ── Time entries ─────────────────────────────────────────────────────────────

export async function createTimeEntry(input: {
  wsId: string;
  taskId: string;
  userId: string;
  userName: string;
  minutes: number;
  note: string | null;
}): Promise<TimeEntryDoc> {
  const fs = db();
  const ref = timeEntriesCol(fs, input.wsId, input.taskId).doc();
  const now = Timestamp.now();
  const data = { ...input, loggedAt: now };
  await ref.set(data);
  return toTimeEntry(ref.id, data as unknown as Record<string, unknown>);
}

export async function deleteTimeEntry(wsId: string, taskId: string, entryId: string): Promise<void> {
  await timeEntriesCol(db(), wsId, taskId).doc(entryId).delete();
}

// ── Labels ────────────────────────────────────────────────────────────────────

function toLabel(id: string, raw: Record<string, unknown>): LabelDoc {
  return {
    id,
    workspaceId: raw.workspaceId as string,
    name: raw.name as string,
    color: (raw.color as string) ?? "#38A9F2",
    createdById: raw.createdById as string,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

export async function getLabels(wsId: string): Promise<LabelDoc[]> {
  const snap = await labelsCol(db(), wsId).orderBy("name", "asc").get();
  return snap.docs.map((d) => toLabel(d.id, d.data() as Record<string, unknown>));
}

export async function createLabel(input: {
  wsId: string;
  name: string;
  color: string;
  createdById: string;
}): Promise<LabelDoc> {
  const fs = db();
  const ref = labelsCol(fs, input.wsId).doc();
  const now = Timestamp.now();
  const data = {
    workspaceId: input.wsId,
    name: input.name,
    color: input.color,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return toLabel(ref.id, data as unknown as Record<string, unknown>);
}

export async function updateLabel(wsId: string, labelId: string, updates: { name?: string; color?: string }): Promise<void> {
  await labelsCol(db(), wsId).doc(labelId).update({ ...updates, updatedAt: Timestamp.now() });
}

export async function deleteLabel(wsId: string, labelId: string): Promise<void> {
  await labelsCol(db(), wsId).doc(labelId).delete();
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export async function addDependency(wsId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
  const fs = db();
  const ref = tasksCol(fs, wsId).doc(taskId);
  await ref.update({
    dependencies: FieldValue.arrayUnion(dependsOnTaskId),
    updatedAt: Timestamp.now(),
  });
}

export async function removeDependency(wsId: string, taskId: string, dependsOnTaskId: string): Promise<void> {
  const fs = db();
  const ref = tasksCol(fs, wsId).doc(taskId);
  await ref.update({
    dependencies: FieldValue.arrayRemove(dependsOnTaskId),
    updatedAt: Timestamp.now(),
  });
}

/** Get open (not completed) tasks that block `taskId`. */
export async function getOpenDependencies(wsId: string, taskId: string): Promise<{ id: string; title: string }[]> {
  const task = await getTaskById(wsId, taskId);
  if (!task || task.dependencies.length === 0) return [];
  const fs = db();
  const snap = await tasksCol(fs, wsId)
    .where("__name__", "in", task.dependencies.slice(0, 30))
    .where("completedAt", "==", null)
    .where("deletedAt", "==", null)
    .get();
  return snap.docs.map((d) => ({ id: d.id, title: (d.data() as Record<string, unknown>).title as string }));
}

// ── Soft delete / trash ───────────────────────────────────────────────────────

export async function softDeleteTask(wsId: string, taskId: string): Promise<void> {
  await tasksCol(db(), wsId).doc(taskId).update({
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export async function restoreTask(wsId: string, taskId: string): Promise<void> {
  await tasksCol(db(), wsId).doc(taskId).update({
    deletedAt: null,
    updatedAt: Timestamp.now(),
  });
}

export async function listDeletedTasks(wsId: string): Promise<TaskDoc[]> {
  const snap = await tasksCol(db(), wsId)
    .where("deletedAt", "!=", null)
    .orderBy("deletedAt", "desc")
    .limit(100)
    .get();
  return snap.docs.map((d) => toTask(d.id, d.data() as Record<string, unknown>));
}
