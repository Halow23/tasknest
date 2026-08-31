import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator, type Auth } from "firebase/auth";

/**
 * Firebase client init. Config values are public by design (they identify the
 * project, not a secret); security comes from the API server's allowlist gate
 * and Firestore's deny-all rules.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let emulated = false;

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  // Point the SDK at local emulators in development (firebase emulators:start)
  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true" && !emulated) {
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
    emulated = true;
  }
  return auth;
}

export function createGoogleProvider(): GoogleAuthProvider {
  return new GoogleAuthProvider();
}
