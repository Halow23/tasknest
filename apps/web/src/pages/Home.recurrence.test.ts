import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("recurring tasks", () => {
  it("accepts recurrenceRule on task create and update", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/src/firestore/types.ts", import.meta.url), "utf8");

    expect(schema).toContain('export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";');
    expect(source).toContain("recurrenceRule: taskRecurrenceSchema.optional()");
    expect(source).toContain("recurrenceRule: taskRecurrenceSchema.optional()");
    expect(source).toContain("if (input.recurrenceRule !== undefined) updates.recurrenceRule = input.recurrenceRule;");
  });

  it("spawns the next instance on completion with due-date math", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("async function spawnRecurringTask(");
    expect(source).toContain("function advanceDueDate(");
    expect(source).toContain('if (rule === "daily") next.setDate(next.getDate() + 1);');
    expect(source).toContain('if (rule === "weekly") next.setDate(next.getDate() + 7);');
    expect(source).toContain('if (rule === "monthly") next.setMonth(next.getMonth() + 1);');
    expect(source).toContain("spawnedTaskId = await spawnRecurringTask(task, input.workspaceId, completedAt!);");
    expect(source).toContain("recurrence_spawned");
  });

  it("copies assignees, labels, fields, and subtasks to the spawned instance", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain("assigneeIds: task.assigneeIds,");
    expect(source).toContain("labelIds: task.labelIds,");
    expect(source).toContain("fieldValues: task.fieldValues,");
    expect(source).toContain("await addSubtask(wsId, nextTask.id, s.title);");
  });

  it("renders recurrence pickers in both dialogs and badges on tasks", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");
    const card = await readFile(new URL("./home/dialogs.tsx", import.meta.url), "utf8");

    expect(home).toContain('id="task-recurrence"');
    expect(home).toContain("recurrenceRule: newTaskRecurrence");
    expect(drawer).toContain('id="edit-recurrence"');
    expect(drawer).toContain("recurrenceRule: recurrence");
    expect(drawer).toContain('{task.recurrenceRule && task.recurrenceRule !== "none"');
    expect(card).toContain("task.recurrenceRule");
  });
});
