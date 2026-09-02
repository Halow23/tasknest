import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task templates", () => {
  it("exposes workspace template CRUD with duplicate rejection and validated apply", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/src/firestore/types.ts", import.meta.url), "utf8");

    expect(source).toContain("template: router({");
    expect(source).toContain("A template with this name already exists.");
    expect(source).toContain("applyTemplate: protectedProcedure");
    expect(source).toContain('throw new TRPCError({ code: "NOT_FOUND", message: "Template not found." })');
    expect(source).toContain('action: "applied_template"');
    expect(schema).toContain("export type TemplateDoc = {");
  });

  it("applies templates by copying priority, recurrence, labels, and subtasks", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("priority: template.priority,");
    expect(source).toContain("recurrenceRule: template.recurrenceRule,");
    expect(source).toContain("const validLabels = allLabels.filter((label) => template.labelIds.includes(label.id));");
    expect(source).toContain("for (const title of template.subtaskTitles ?? []) {");
  });

  it("picks templates in the create dialog and saves them from the edit dialog", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(home).toContain('id="task-template"');
    expect(home).toContain("applyTemplate.mutate({ projectId: activeProject.id, workspaceId: workspace.id, templateId: template.id })");
    expect(home).toContain("trpc.tasknest.template.list.useQuery");
    expect(drawer).toContain('id="save-template"');
    expect(drawer).toContain("subtaskTitles: task.subtasks.map(item => item.title)");
    expect(drawer).toContain("trpc.tasknest.template.create.useMutation({");
  });
});
