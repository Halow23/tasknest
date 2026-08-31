import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK init for the API server. All data access goes through
 * the Admin SDK, which bypasses Firestore/Storage rules (they stay deny-all).
 *
 * Credentials: FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON, the
 * easiest to configure on Railway/Render). The Auth/Firestore/Storage
 * emulators are used whenever FIRESTORE_EMULATOR_HOST is set, which is how
 * tests and local dev run without real credentials.
 */
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
  return undefined;
}

let cachedApp: App | undefined;

export function getFirebaseApp(): App {
  if (!cachedApp) {
    cachedApp = getApps().length
      ? getApps()[0]
      : initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          credential: getServiceAccount(),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
  }
  return cachedApp;
}

export function firebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function firestore() {
  const db = getFirestore(getFirebaseApp());
  // Prefer native timestamps; the port stores Dates directly.
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

export function firebaseStorage() {
  return getStorage(getFirebaseApp());
}
