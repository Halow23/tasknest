import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("TaskNest sign-in brand lockup", () => {
  it("renders the requested author credit beside the TaskNest logo as semantic content", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain('className="flex items-center gap-3"');
    expect(source).toContain('alt="TaskNest"');
    expect(source).toContain("TaskNest</p><p");
    expect(source).toContain("by Rafael Udtohan of Team SYNAPSE");
  });
});

/**
 * `auth.me` is what turns a Firebase identity into an authenticated session.
 * It is enabled from the first onAuthStateChanged, which reports the
 * signed-out state, so a later popup sign-in must explicitly refresh it or the
 * user stays on the login screen until a manual reload.
 */
describe("auth session refresh", () => {
  const readAuth = () => readFile(new URL("../_core/hooks/useAuth.ts", import.meta.url), "utf8");

  it("refetches the server user record when the Firebase identity changes", async () => {
    const source = await readAuth();
    expect(source).toContain("void utils.auth.me.invalidate();");
    expect(source).toContain("firebaseUser?.uid");
    // Without the firebaseReady guard the effect fires before the first
    // onAuthStateChanged and invalidates a query that is not enabled yet.
    expect(source).toContain("if (!firebaseReady) return;");
  });
});
