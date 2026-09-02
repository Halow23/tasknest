/**
 * Firestore client helpers. All data access goes through the firebase-admin
 * SDK (bypasses Security Rules — the API is the only gateway).
 *
 * Timestamps: Firestore stores Timestamps; these helpers convert them to Date
 * using `toDate()` so the application layer never touches the Firestore type.
 */

import { firestore } from "../_core/firebase";
import type { CollectionReference, DocumentReference, Query } from "firebase-admin/firestore";

// ── Re-export the firestore instance ────────────────────────────────────────

export function db() {
  return firestore();
}

// ── Timestamp conversion ────────────────────────────────────────────────────

import { Timestamp } from "firebase-admin/firestore";

/** Convert any value that might be a Firestore Timestamp or Date to a Date. */
export function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date();
}

/** Convert a nullable Firestore Timestamp or Date to a nullable Date. */
export function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  return toDate(value);
}

// ── Typed collection references ─────────────────────────────────────────────

type FS = ReturnType<typeof firestore>;

export function usersCol(fs: FS) {
  return fs.collection("users") as CollectionReference;
}

export function workspacesCol(fs: FS) {
  return fs.collection("workspaces") as CollectionReference;
}

export function workspaceDoc(fs: FS, wsId: string): DocumentReference {
  return fs.collection("workspaces").doc(wsId);
}

export function projectsCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("projects");
}

export function tasksCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("tasks");
}

export function commentsCol(fs: FS, wsId: string, taskId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("tasks").doc(taskId).collection("comments");
}

export function attachmentsCol(fs: FS, wsId: string, taskId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("tasks").doc(taskId).collection("attachments");
}

export function activityCol(fs: FS, wsId: string, taskId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("tasks").doc(taskId).collection("activity");
}

export function timeEntriesCol(fs: FS, wsId: string, taskId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("tasks").doc(taskId).collection("timeEntries");
}

export function labelsCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("labels");
}

export function invitesCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("invites");
}

export function notificationsCol(fs: FS, uid: string): CollectionReference {
  return fs.collection("users").doc(uid).collection("notifications");
}

export function templatesCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("templates");
}

export function automationRulesCol(fs: FS, wsId: string): CollectionReference {
  return fs.collection("workspaces").doc(wsId).collection("automationRules");
}

export function allowedDomainsCol(fs: FS): CollectionReference {
  return fs.collection("allowedDomains");
}

export function allowedEmailsCol(fs: FS): CollectionReference {
  return fs.collection("allowedEmails");
}

export function deniedSignInAlertsCol(fs: FS): CollectionReference {
  return fs.collection("deniedSignInAlerts");
}

export function deniedSignInEventsCol(fs: FS): CollectionReference {
  return fs.collection("deniedSignInEvents");
}

// ── Query helpers ────────────────────────────────────────────────────────────

/** Fetch all docs from a query as plain objects with `id` injected. */
export async function getDocs<T>(query: Query | CollectionReference): Promise<(T & { id: string })[]> {
  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T & { id: string }));
}

/** Fetch a single document, returning null if it doesn't exist. */
export async function getDoc<T>(ref: DocumentReference): Promise<(T & { id: string }) | null> {
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T & { id: string };
}

/**
 * Batch `where('__name__', 'in', ids)` calls in chunks of 30.
 * Firestore's `in` operator is capped at 30 items per query.
 */
export async function getDocsByIds<T>(
  col: CollectionReference,
  ids: string[],
): Promise<(T & { id: string })[]> {
  if (ids.length === 0) return [];
  const unique = Array.from(new Set(ids));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));
  const results = await Promise.all(
    chunks.map((chunk) => getDocs<T>(col.where("__name__", "in", chunk))),
  );
  return results.flat();
}

/** Generate a new document ID without writing anything. */
export function newId(col: CollectionReference): string {
  return col.doc().id;
}

/** Server timestamp value for Firestore writes. */
export function serverNow() {
  return Timestamp.now();
}
