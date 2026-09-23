import { describe, expect, it } from "vitest";

/**
 * Regression test for the Firestore singleton bug.
 *
 * `getFirestore()` returns a process-wide singleton, and the SDK permits
 * `settings()` to be called only once per instance and only before any other
 * method. The accessor previously called `settings()` on every invocation,
 * so the SECOND caller threw:
 *
 *   "Firestore has already been initialized. You can only call settings()
 *    once, and only before calling any other methods on a Firestore object."
 *
 * The API calls the accessor at least twice within a single authenticated
 * request (upsertUser, then getUserByUid), so the throw made every signed-in
 * request fail with UNAUTHORIZED. This test pins the accessor to the
 * call-once contract so the regression cannot return unnoticed.
 *
 * The dynamic import below pulls in the whole firebase-admin SDK: ~570ms alone
 * but 2.5s+ when the workspace runs its test suites concurrently. The default
 * 5000ms timeout is too tight for that, so raise it explicitly.
 */
const IMPORT_TIMEOUT_MS = 30_000;

describe("firestore() accessor", () => {
  it("can be called repeatedly without throwing", { timeout: IMPORT_TIMEOUT_MS }, async () => {
    process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
    process.env.FIREBASE_PROJECT_ID ??= "tasknest-fu2026";

    const { firestore } = await import("./firebase");

    for (let i = 1; i <= 5; i++) {
      expect(
        () => firestore(),
        `firestore() threw on call #${i}; settings() must run only once`,
      ).not.toThrow();
    }
  });

  it("returns the same instance on every call", { timeout: IMPORT_TIMEOUT_MS }, async () => {
    process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
    process.env.FIREBASE_PROJECT_ID ??= "tasknest-fu2026";

    const { firestore } = await import("./firebase");
    expect(firestore()).toBe(firestore());
  });
});
