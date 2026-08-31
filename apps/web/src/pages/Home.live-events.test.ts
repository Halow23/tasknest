import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("real-time workspace events", () => {
  it("publishes every activity event to the in-process emitter", async () => {
    const emitter = await readFile(new URL("../../../api/src/events.ts", import.meta.url), "utf8");
    const router = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(emitter).toContain("export const workspaceEvents = new EventEmitter()");
    expect(emitter).toContain("export function publishWorkspaceEvent");
    expect(router).toContain("import { publishWorkspaceEvent } from \"../events\";");
    expect(router).toContain("publishWorkspaceEvent({ workspaceId: input.workspaceId, type: input.type");
  });

  it("streams authenticated workspace-scoped SSE events with heartbeats", async () => {
    const route = await readFile(new URL("../../../api/src/_core/workspaceEvents.ts", import.meta.url), "utf8");

    expect(route).toContain('app.get("/api/events"');
    expect(route).toContain("sdk.authenticateRequest(req)");
    expect(route).toContain('"Content-Type": "text/event-stream"');
    expect(route).toContain("if (event.workspaceId !== workspace.id) return;");
    expect(route).toContain('": heartbeat\\n\\n"');
    expect(route).toContain('req.on("close", cleanup)');
  });

  it("invalidates task caches on live events from the client", async () => {
    const hook = await readFile(new URL("../hooks/useWorkspaceEvents.ts", import.meta.url), "utf8");
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(hook).toContain('new EventSource("/api/events")');
    expect(hook).toContain('queryKey: [["tasknest", "task", "list"]]');
    expect(hook).toContain('queryKey: [["tasknest", "notification", "list"]]');
    expect(home).toContain("useWorkspaceEvents({ enabled: isAuthenticated && workspace !== null, currentUserId: user?.id });");
  });
});
