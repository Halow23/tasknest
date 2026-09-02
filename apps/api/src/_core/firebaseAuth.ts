import type { Request } from "express";
import { ENV } from "./env";
import { firebaseAuth } from "./firebase";
import { getUserByUid, upsertUser } from "../firestore/workspace";
import type { UserDoc } from "../firestore/types";

/**
 * Firebase-authenticated request user. `id` is the Firebase UID (string).
 */
export type AuthenticatedUser = UserDoc & { isCron?: boolean };

/** Cron invocations carry the shared secret instead of a Firebase token. */
export const CRON_USER: AuthenticatedUser = {
  id: "system-cron",
  openId: "system-cron",
  name: "Scheduled Jobs",
  email: null,
  loginMethod: "system",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  isCron: true,
};

function bearerTokenFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim() || null;
  const query = req.query.token;
  if (typeof query === "string" && query.length > 0) return query;
  return null;
}

async function authenticateWithFirebase(token: string): Promise<AuthenticatedUser | null> {
  const decoded = await firebaseAuth().verifyIdToken(token);
  const email = decoded.email ?? null;
  const name = decoded.name ?? email ?? "TaskNest user";

  const role = email && ENV.adminEmails.includes(email.trim().toLowerCase()) ? "admin" : undefined;
  await upsertUser({
    openId: decoded.uid,
    name,
    email,
    loginMethod: "google",
    ...(role ? { role } : {}),
  });
  const user = await getUserByUid(decoded.uid);
  if (!user) throw new Error("User record missing after upsert.");
  return user;
}

/**
 * Verifies the Firebase ID token and returns the request user.
 * Returns null for missing/invalid credentials.
 */
export async function authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
  const secret = req.header("x-cron-secret") ?? (req.body as Record<string, unknown> | undefined)?.["cronSecret"];
  if (typeof secret === "string" && ENV.cronSecret && secret === ENV.cronSecret) {
    return CRON_USER;
  }

  const token = bearerTokenFrom(req);
  if (!token) return null;

  try {
    return await authenticateWithFirebase(token);
  } catch {
    return null;
  }
}
