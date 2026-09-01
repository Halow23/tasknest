import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { firebaseAuth } from "./firebase";

/**
 * Firebase-authenticated request user. `id` is the numeric MySQL user id
 * (transitional — Phase 4 moves it to the Firestore-allocated numeric id);
 * `openId` stores the Firebase UID.
 */
export type AuthenticatedUser = User & { isCron?: boolean };

/** Cron invocations carry the shared secret instead of a Firebase token. */
export const CRON_USER: AuthenticatedUser = {
  id: -1,
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
  // Note: no checkRevoked flag — the Auth emulator mints unsigned tokens
  // without a kid claim, which revocation checking rejects.
  const decoded = await firebaseAuth().verifyIdToken(token);
  const email = decoded.email ?? null;
  const name = decoded.name ?? email ?? "TaskNest user";

  const role = email && ENV.adminEmails.includes(email.trim().toLowerCase()) ? "admin" : undefined;
  await db.upsertUser({
    openId: decoded.uid,
    name,
    email,
    loginMethod: "google",
    ...(role ? { role } : {}),
  });
  const user = await db.getUserByOpenId(decoded.uid);
  if (!user) throw new Error("User record missing after upsert.");
  return user;
}

/**
 * Verifies the Firebase ID token (Authorization: Bearer, or ?token= for the
 * SSE EventSource, which cannot set headers) and returns the request user.
 * Returns null for missing/invalid credentials — public procedures still work.
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
