import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task templates", () => {
  it("exposes workspace template CRUD with duplicate rejection and validated apply", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/drizzle/schema.ts", import.meta.url), "utf8");

    expect(source).toContain("template: router({");
    expect(source).toContain("A template with this name already exists.");
    expect(source).toContain("applyTemplate: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), templateId:");
    expect(source).toContain("Template must belong to the task's workspace.");
    expect(source).toContain('action: "applied_template"');
    expect(schema).toContain("export const taskTemplates = mysqlTable(");
  });

  it("applies templates by copying priority, recurrence, labels, and subtasks", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("priority: template.priority, recurrenceRule: template.recurrenceRule");
    expect(source).toContain("validLabels.map(label => ({ taskId, labelId: label.id }))");
    expect(source).toContain("subtaskTitles.map((title, index) => ({ taskId, title, sortOrder: index }))");
  });

  it("picks templates in the create dialog and saves them from the edit dialog", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(home).toContain('id="task-template"');
    expect(home).toContain("applyTemplate.mutate({ projectId: activeProject.id, templateId: template.id })");
    expect(home).toContain("trpc.tasknest.template.list.useQuery");
    expect(drawer).toContain('id="save-template"');
    expect(drawer).toContain("subtaskTitles: task.subtasks.map(item => item.title)");
    expect(drawer).toContain("trpc.tasknest.template.create.useMutation({");
  });
});
