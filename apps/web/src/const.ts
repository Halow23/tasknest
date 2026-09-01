import { signInWithPopup, type UserCredential } from "firebase/auth";
import { createGoogleProvider, getFirebaseAuth } from "@/lib/firebase";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Start the Google sign-in popup. Call from an event handler (e.g.
 * `onClick={() => void startLogin()}`). Returns the credential on success,
 * null when the user closes the popup, and throws on real failures.
 */
export async function startLogin(): Promise<UserCredential | null> {
  const auth = getFirebaseAuth();
  try {
    const provider = createGoogleProvider();
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return null;
    }
    throw error;
  }
}
