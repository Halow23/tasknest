import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The error logger in main.tsx is the only thing standing between a failing
 * API call and an unreadable console. These tests pin the behaviour that makes
 * failures diagnosable: the procedure name, the status/code, and the Firestore
 * index URL on its own line.
 */
describe("api error logging", () => {
  const read = (p: string) => readFile(new URL(p, import.meta.url), "utf8");

  it("reports the failing procedure, status and code", async () => {
    const main = await read("../main.tsx");
    expect(main).toContain("const describeApiError = (error: unknown, source: \"query\" | \"mutation\", label: string)");
    expect(main).toContain("[API ${source}] ${label} -> HTTP ${status} (${code})");
    expect(main).toContain("const labelFromKey = (key: readonly unknown[]) =>");
  });

  it("surfaces the Firestore composite-index link on its own line", async () => {
    const main = await read("../main.tsx");
    expect(main).toContain("console\\.firebase\\.google\\.com");
    expect(main).toContain("Firestore needs a composite index. Create it here:");
  });

  it("throttles repeated identical failures instead of spamming the console", async () => {
    const main = await read("../main.tsx");
    expect(main).toContain("const LOG_THROTTLE_MS = 60_000;");
    expect(main).toContain("if (previous && now - previous < LOG_THROTTLE_MS) return;");
    // Both caches must go through the throttle, not console.error directly.
    expect(main).not.toContain('console.error("[API Query Error]", error)');
    expect(main).not.toContain('console.error("[API Mutation Error]", error)');
  });

  it("stays silent for the 401s that sign-out produces", async () => {
    const main = await read("../main.tsx");
    expect(main).toContain("const isExpectedSignedOutError = (error: unknown) =>");
    expect(main).toContain("return getFirebaseAuth().currentUser === null;");
    // The signed-out check must gate the whole report, not just the log call,
    // so no auth re-verification fires for a session that is already gone.
    expect(main).toContain("const reportApiError = (");
    expect(main).toContain("  if (isExpectedSignedOutError(error)) return;");
  });

  it("never invalidates auth.me in response to auth.me failing", async () => {
    const main = await read("../main.tsx");
    // Invalidating a query because that query just 401'd refetches it forever.
    expect(main).toContain("const isAuthMeKey = (key: readonly unknown[]) =>");
    expect(main).toContain("if (queryKey && isAuthMeKey(queryKey)) return;");
  });
});
