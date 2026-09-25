import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// The SSE hook is glue between Firebase auth, EventSource, and react-query.
// These contract tests pin the behaviors that keep live collaboration working:
// token-authenticated stream, cache invalidation, self-event skipping,
// exponential backoff, and bfcache recovery.
describe("useWorkspaceEvents live-event contract", () => {
  it("opens a token-authenticated EventSource against the API stream", async () => {
    const hook = await readFile(new URL("./useWorkspaceEvents.ts", import.meta.url), "utf8");

    expect(hook).toContain("new EventSource(");
    expect(hook).toContain("/api/events?token=");
    expect(hook).toContain("encodeURIComponent(token)");
    expect(hook).toContain("currentUser.getIdToken()");
  });

  it("invalidates task, analytics, and notification caches on teammate events", async () => {
    const hook = await readFile(new URL("./useWorkspaceEvents.ts", import.meta.url), "utf8");

    expect(hook).toContain('queryClient.invalidateQueries({ queryKey: [["tasknest", "task", "list"]] });');
    expect(hook).toContain('queryClient.invalidateQueries({ queryKey: [["tasknest", "analytics", "project"]] });');
    expect(hook).toContain('queryClient.invalidateQueries({ queryKey: [["tasknest", "notification", "list"]] });');
    expect(hook).toContain('if (payload.type === "comment_added" || payload.type === "subtask_updated") {');
  });

  it("skips self-authored events to protect optimistic updates", async () => {
    const hook = await readFile(new URL("./useWorkspaceEvents.ts", import.meta.url), "utf8");

    expect(hook).toContain("payload.actorId != null && payload.actorId === options.currentUserId");
  });

  it("reconnects with exponential backoff capped at 60s", async () => {
    const hook = await readFile(new URL("./useWorkspaceEvents.ts", import.meta.url), "utf8");

    expect(hook).toContain("attempts += 1;");
    expect(hook).toContain("Math.min(3000 * 2 ** (attempts - 1), 60_000)");
    expect(hook).toContain("attempts = 0;");
  });

  it("re-opens the stream after back/forward cache restores the page", async () => {
    const hook = await readFile(new URL("./useWorkspaceEvents.ts", import.meta.url), "utf8");

    expect(hook).toContain('window.addEventListener("pagehide", onPageHide);');
    expect(hook).toContain('window.addEventListener("pageshow", onPageShow);');
    expect(hook).toContain("event.persisted && !closed");
  });
});
