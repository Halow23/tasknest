import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("time tracking", () => {
  it("exposes guarded log and delete procedures with activity logging", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("time: router({");
    expect(source).toContain("minutes: z.number().int().min(1).max(10_080)");
    expect(source).toContain('action: "time_logged", minutes: input.minutes');
    expect(source).toContain("deleteTimeEntry(input.workspaceId, input.taskId, input.entryId)");
  });

  it("returns joined time entries in task detail", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const taskModule = await readFile(new URL("../../../api/src/firestore/task.ts", import.meta.url), "utf8");

    expect(source).toContain("timeEntries: detail.timeEntries");
    expect(taskModule).toContain('timeEntriesCol(fs, wsId, taskId).orderBy("loggedAt", "desc")');
  });

  it("renders the Time section with a live timer, manual log, and entry list", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain('aria-label="Time tracking"');
    expect(drawer).toContain('aria-label="Start timer"');
    expect(drawer).toContain('aria-label="Stop timer and log"');
    expect(drawer).toContain("const totalLoggedMinutes = (task?.timeEntries ?? []).reduce((sum, entry) => sum + entry.minutes, 0);");
    expect(drawer).toContain("Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000))");
    expect(drawer).toContain('logTimeMutation.mutate({ taskId: task.id, workspaceId, minutes: Number(timeMinutes)');
    expect(drawer).toContain('aria-label={`Delete time entry ${entry.id}`}');
  });
});
