import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs";
import path from "node:path";

/**
 * Firebase Admin SDK init for the API server. All data access goes through
 * the Admin SDK, which bypasses Firestore/Storage rules (they stay deny-all).
 *
 * Credentials are resolved in this order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON — full service-account JSON inline
 *      (the easiest to configure on Railway/Render).
 *   2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY — the discrete values.
 *   3. firebase-service-account.json on disk (gitignored), for local runs
 *      against the real project without exporting secrets into the shell.
 *
 * When none are present the app falls back to Application Default Credentials,
 * which is what lets the Auth/Firestore emulators run without real credentials
 * (they are selected via FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST).
 */
function readServiceAccountFile(): Record<string, unknown> | null {
  // The source lives in apps/api/src/_core while the bundle lands in
  // apps/api/dist, so no single relative path covers both. These candidates
  // are explicit and bounded — we never walk into unrelated parent folders.
  const candidates = [
    path.resolve(import.meta.dirname, "../../../../firebase-service-account.json"),
    path.resolve(import.meta.dirname, "../../../firebase-service-account.json"),
    path.resolve(process.cwd(), "firebase-service-account.json"),
    path.resolve(process.cwd(), "../../firebase-service-account.json"),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return JSON.parse(fs.readFileSync(candidate, "utf8"));
    } catch {
      // A malformed file must not take down startup; fall through so the next
      // candidate (or Application Default Credentials) gets a chance.
      return null;
    }
  }
  return null;
}

function getServiceAccount(): ReturnType<typeof cert> | undefined {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    return cert(JSON.parse(raw));
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Env vars escape newlines as literal \n
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    });
  }
  const fromFile = readServiceAccountFile();
  if (fromFile) {
    return cert(fromFile as Parameters<typeof cert>[0]);
  }
  return undefined;
}

let cachedApp: App | undefined;

export function getFirebaseApp(): App {
  if (!cachedApp) {
    const serviceAccount = getServiceAccount();
    cachedApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          // The credential key must be absent (not undefined) when no service
          // account is configured — the SDK rejects `credential: undefined`.
          ...(serviceAccount ? { credential: serviceAccount } : {}),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
  }
  return cachedApp;
}

export function firebaseAuth() {
  return getAuth(getFirebaseApp());
}

let cachedFirestore: ReturnType<typeof getFirestore> | undefined;

export function firestore() {
  // getFirestore() returns a process-wide singleton, and the SDK allows
  // settings() to be called only once per instance and only before any other
  // method. Calling it on every access throws "Firestore has already been
  // initialized" from the second caller onward, so configure it exactly once
  // and reuse the instance.
  if (!cachedFirestore) {
    cachedFirestore = getFirestore(getFirebaseApp());
    // Prefer native timestamps; the port stores Dates directly.
    cachedFirestore.settings({ ignoreUndefinedProperties: true });
  }
  return cachedFirestore;
}

export function firebaseStorage() {
  return getStorage(getFirebaseApp());
}
