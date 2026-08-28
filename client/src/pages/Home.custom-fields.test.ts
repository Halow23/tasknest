import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("custom fields integration", () => {
  it("renders custom field controls in both task dialogs and submits field values", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("tasknest.field.list");
    expect(source).toContain("<TaskCustomFields fields={projectFieldsList}");
    expect(source).toContain("<TaskCustomFields fields={fields}");
    expect(source).toContain("fieldValues: toFieldValuesInput(newTaskFieldValues)");
    expect(source).toContain("fieldValues: toFieldValuesInput(fieldValues)");
    expect(source).toContain("<ProjectFieldsManager projectId={activeProject.id} />");
    expect(source).toContain("task.fieldValues?.length > 0");
  });

  it("replaces native select and date inputs with shadcn Select and Calendar components", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('id="task-assignee"');
    expect(source).toContain("<SelectTrigger id=\"task-assignee\"");
    expect(source).toContain("<SelectTrigger id=\"edit-priority\"");
    expect(source).toContain("<DueDatePicker id=\"edit-due\" value={dueDate} onChange={setDueDate} />");
    expect(source).not.toContain('<select id="task-assignee"');
    expect(source).not.toContain('<select id="edit-priority"');
    expect(source).not.toContain('type="date"');
  });

  it("uses the shadcn calendar popover pattern for date custom fields", async () => {
    const source = await readFile(new URL("../components/TaskCustomFields.tsx", import.meta.url), "utf8");

    expect(source).toContain("<Calendar mode=\"single\"");
    expect(source).toContain("<PopoverTrigger asChild>");
    expect(source).toContain("field.type === \"select\"");
    expect(source).toContain("field.type === \"date\"");
    expect(source).toContain("field.type === \"text\"");
  });
});
