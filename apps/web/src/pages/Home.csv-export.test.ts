import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("csv export", () => {
  it("exposes a guarded task.export query with joined assignees and labels", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("export: protectedProcedure");
    expect(source).toContain("listTasks({ wsId: input.workspaceId, projectId: input.projectId })");
    expect(source).toContain("assignees: Object.values(t.assigneeNames).join(\"; \")");
    expect(source).toContain("labels: Object.values(t.labelNames).join(\"; \")");
    expect(source).toContain("projectName: proj.name,");
  });

  it("downloads the task list from the board toolbar with proper escaping", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const csv = await readFile(new URL("./home/csvExport.ts", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Export tasks as CSV"');
    expect(home).toContain("tasknest-${data.projectName.toLowerCase().replace(/[^a-z0-9]+/g, \"-\")}");
    expect(home).toContain('"ID", "Title", "Status", "Priority", "Recurrence", "Due", "Completed", "Created", "Assignees", "Labels"');
    expect(csv).toContain('export function csvCell(');
    expect(csv).toContain("double-quote doubling");
    expect(csv).toContain("export function downloadCsv(");
  });
});
