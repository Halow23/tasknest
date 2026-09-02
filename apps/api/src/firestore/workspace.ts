/**
 * Workspace and user helpers backed by Firestore.
 * Replaces the workspace/user portions of the old db.ts.
 */

import { TRPCError } from "@trpc/server";
import {
  db,
  getDoc,
  getDocs,
  invitesCol,
  newId,
  notificationsCol,
  projectsCol,
  tasksCol,
  toDate,
  toDateOrNull,
  usersCol,
  workspaceDoc,
  workspacesCol,
} from "./db";
import type {
  InviteDoc,
  NotificationDoc,
  NotificationType,
  ProjectDoc,
  UserDoc,
  UserRole,
  WorkspaceDoc,
  WorkspaceMember,
} from "./types";
import { nanoid } from "nanoid";
import { Timestamp } from "firebase-admin/firestore";

// ── Users ────────────────────────────────────────────────────────────────────

/** Convert raw Firestore data → typed UserDoc with proper Date fields. */
function toUser(id: string, raw: Record<string, unknown>): UserDoc {
  return {
    id,
    openId: (raw.openId as string) ?? id,
    name: (raw.name as string | null) ?? null,
    email: (raw.email as string | null) ?? null,
    role: (raw.role as UserRole) ?? "user",
    loginMethod: (raw.loginMethod as string) ?? "google",
    lastSignedIn: toDate(raw.lastSignedIn),
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

export async function getUserByUid(uid: string): Promise<UserDoc | null> {
  const fs = db();
  const snap = await usersCol(fs).doc(uid).get();
  if (!snap.exists) return null;
  return toUser(snap.id, snap.data() as Record<string, unknown>);
}

export async function upsertUser(input: {
  openId: string;       // Firebase UID — used as doc ID
  name: string | null;
  email: string | null;
  loginMethod: string;
  role?: UserRole;
}): Promise<void> {
  const fs = db();
  const ref = usersCol(fs).doc(input.openId);
  const now = Timestamp.now();
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      openId: input.openId,
      name: input.name,
      email: input.email,
      role: input.role ?? "user",
      loginMethod: input.loginMethod,
      lastSignedIn: now,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const updates: Record<string, unknown> = {
      lastSignedIn: now,
      updatedAt: now,
      name: input.name,
    };
    if (input.role !== undefined) updates.role = input.role;
    await ref.update(updates);
  }
}

// ── Workspace helpers ────────────────────────────────────────────────────────

function toWorkspace(id: string, raw: Record<string, unknown>): WorkspaceDoc {
  const rawMembers = (raw.members as Record<string, unknown>[] | undefined) ?? [];
  const members: WorkspaceMember[] = rawMembers.map((m) => ({
    userId: m.userId as string,
    name: (m.name as string | null) ?? null,
    email: (m.email as string | null) ?? null,
    role: (m.role as UserRole) ?? "user",
    joinedAt: toDate(m.joinedAt),
  }));
  return {
    id,
    name: raw.name as string,
    ownerId: raw.ownerId as string,
    members,
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

export async function getWorkspaceById(wsId: string): Promise<WorkspaceDoc | null> {
  const fs = db();
  const snap = await workspaceDoc(fs, wsId).get();
  if (!snap.exists) return null;
  return toWorkspace(snap.id, snap.data() as Record<string, unknown>);
}

export async function getWorkspaceForUser(uid: string): Promise<WorkspaceDoc | null> {
  const fs = db();
  const snap = await workspacesCol(fs)
    .where("members", "array-contains-any", [{ userId: uid }])
    .limit(1)
    .get();
  // array-contains-any with objects is unreliable — use memberIds array instead
  // Fallback: query by memberIds field (maintained in parallel)
  const snap2 = await workspacesCol(fs)
    .where("memberIds", "array-contains", uid)
    .limit(1)
    .get();
  if (!snap2.empty) {
    const doc = snap2.docs[0];
    return toWorkspace(doc.id, doc.data() as Record<string, unknown>);
  }
  if (!snap.empty) {
    const doc = snap.docs[0];
    return toWorkspace(doc.id, doc.data() as Record<string, unknown>);
  }
  return null;
}

export async function createWorkspace(input: { name: string; ownerId: string; ownerName: string | null; ownerEmail: string | null }): Promise<WorkspaceDoc> {
  const fs = db();
  const ref = workspacesCol(fs).doc();
  const now = Timestamp.now();
  const member: WorkspaceMember = {
    userId: input.ownerId,
    name: input.ownerName,
    email: input.ownerEmail,
    role: "admin",
    joinedAt: new Date(),
  };
  const data = {
    name: input.name,
    ownerId: input.ownerId,
    members: [member],
    memberIds: [input.ownerId],  // flat array for array-contains queries
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(data);
  return toWorkspace(ref.id, { ...data, members: [member] } as Record<string, unknown>);
}

export async function getWorkspaceMember(wsId: string, uid: string): Promise<WorkspaceMember | null> {
  const ws = await getWorkspaceById(wsId);
  if (!ws) return null;
  return ws.members.find((m) => m.userId === uid) ?? null;
}

export async function assertWorkspaceMember(wsId: string, uid: string): Promise<WorkspaceDoc> {
  const ws = await getWorkspaceById(wsId);
  if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found." });
  const isMember = ws.members.some((m) => m.userId === uid);
  if (!isMember) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this workspace." });
  return ws;
}

export async function addWorkspaceMember(wsId: string, user: Pick<UserDoc, "id" | "name" | "email" | "role">): Promise<void> {
  const fs = db();
  const ref = workspaceDoc(fs, wsId);
  const member: WorkspaceMember = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    joinedAt: new Date(),
  };
  // Use arrayUnion to avoid overwriting concurrent members
  const { FieldValue } = await import("firebase-admin/firestore");
  await ref.update({
    members: FieldValue.arrayUnion(member),
    memberIds: FieldValue.arrayUnion(user.id),
    updatedAt: Timestamp.now(),
  });
}

// ── Project helpers ──────────────────────────────────────────────────────────

function toProject(id: string, raw: Record<string, unknown>): ProjectDoc {
  const rawFields = (raw.fields as Record<string, unknown>[] | undefined) ?? [];
  return {
    id,
    workspaceId: raw.workspaceId as string,
    name: raw.name as string,
    description: (raw.description as string | null) ?? null,
    color: (raw.color as string) ?? "#38A9F2",
    archived: (raw.archived as boolean) ?? false,
    deletedAt: toDateOrNull(raw.deletedAt),
    createdById: raw.createdById as string,
    fields: rawFields.map((f) => ({
      id: f.id as string,
      name: f.name as string,
      type: f.type as "text" | "select" | "date",
      options: (f.options as string[] | null) ?? null,
      sortOrder: (f.sortOrder as number) ?? 0,
      createdById: f.createdById as string,
      createdAt: toDate(f.createdAt),
      updatedAt: toDate(f.updatedAt),
    })),
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  };
}

export async function getProjectById(wsId: string, projId: string): Promise<ProjectDoc | null> {
  const fs = db();
  const snap = await projectsCol(fs, wsId).doc(projId).get();
  if (!snap.exists) return null;
  return toProject(snap.id, snap.data() as Record<string, unknown>);
}

export async function assertProjectMember(projId: string, uid: string): Promise<ProjectDoc> {
  // Projects are scoped to workspaces; we need to find which workspace owns this project.
  // We store workspaceId on the project doc for exactly this lookup.
  const fs = db();
  // Search across workspaces the user belongs to
  const ws = await getWorkspaceForUser(uid);
  if (!ws) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  const proj = await getProjectById(ws.id, projId);
  if (!proj || proj.deletedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
  return proj;
}

export async function getActiveProjects(wsId: string): Promise<ProjectDoc[]> {
  const fs = db();
  const snap = await projectsCol(fs, wsId)
    .where("archived", "==", false)
    .where("deletedAt", "==", null)
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => toProject(d.id, d.data() as Record<string, unknown>));
}

// ── Invite helpers ───────────────────────────────────────────────────────────

function toInvite(id: string, raw: Record<string, unknown>): InviteDoc {
  return {
    id,
    workspaceId: raw.workspaceId as string,
    token: raw.token as string,
    createdById: raw.createdById as string,
    recipientEmail: (raw.recipientEmail as string | null) ?? null,
    expiresAt: toDate(raw.expiresAt),
    acceptedAt: toDateOrNull(raw.acceptedAt),
    acceptedById: (raw.acceptedById as string | null) ?? null,
    revokedAt: toDateOrNull(raw.revokedAt),
    createdAt: toDate(raw.createdAt),
  };
}

export async function getInviteByToken(token: string): Promise<InviteDoc | null> {
  // Tokens are stored as the doc ID for O(1) lookup
  const fs = db();
  // We need to search across all workspaces — store token as a separate top-level collection index
  const snap = await fs.collection("inviteIndex").doc(token).get();
  if (!snap.exists) return null;
  const { workspaceId } = snap.data() as { workspaceId: string };
  const invSnap = await invitesCol(fs, workspaceId).where("token", "==", token).limit(1).get();
  if (invSnap.empty) return null;
  return toInvite(invSnap.docs[0].id, invSnap.docs[0].data() as Record<string, unknown>);
}

export async function createInvite(input: {
  workspaceId: string;
  token: string;
  createdById: string;
  recipientEmail: string | null;
  expiresAt: Date;
}): Promise<InviteDoc> {
  const fs = db();
  const ref = invitesCol(fs, input.workspaceId).doc();
  const now = Timestamp.now();
  const data = {
    workspaceId: input.workspaceId,
    token: input.token,
    createdById: input.createdById,
    recipientEmail: input.recipientEmail,
    expiresAt: Timestamp.fromDate(input.expiresAt),
    acceptedAt: null,
    acceptedById: null,
    revokedAt: null,
    createdAt: now,
  };
  const batch = fs.batch();
  batch.set(ref, data);
  // Index for token lookup
  batch.set(fs.collection("inviteIndex").doc(input.token), { workspaceId: input.workspaceId });
  await batch.commit();
  return toInvite(ref.id, data as Record<string, unknown>);
}

export async function acceptInvite(inviteId: string, wsId: string, acceptedById: string): Promise<void> {
  const fs = db();
  await invitesCol(fs, wsId).doc(inviteId).update({
    acceptedAt: Timestamp.now(),
    acceptedById,
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

function toNotification(id: string, raw: Record<string, unknown>): NotificationDoc {
  return {
    id,
    userId: raw.userId as string,
    type: raw.type as NotificationType,
    actorId: raw.actorId as string,
    actorName: (raw.actorName as string) ?? "",
    taskId: (raw.taskId as string | null) ?? null,
    taskTitle: (raw.taskTitle as string | null) ?? null,
    workspaceId: raw.workspaceId as string,
    readAt: toDateOrNull(raw.readAt),
    createdAt: toDate(raw.createdAt),
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  taskId: string | null;
  taskTitle: string | null;
  workspaceId: string;
}): Promise<void> {
  const fs = db();
  const ref = notificationsCol(fs, input.userId).doc();
  await ref.set({
    ...input,
    readAt: null,
    createdAt: Timestamp.now(),
  });
}

export async function getNotificationsForUser(uid: string): Promise<NotificationDoc[]> {
  const fs = db();
  const snap = await notificationsCol(fs, uid)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => toNotification(d.id, d.data() as Record<string, unknown>));
}

export async function markNotificationsRead(uid: string, ids: string[]): Promise<void> {
  const fs = db();
  const batch = fs.batch();
  const now = Timestamp.now();
  for (const id of ids) {
    batch.update(notificationsCol(fs, uid).doc(id), { readAt: now });
  }
  await batch.commit();
}
