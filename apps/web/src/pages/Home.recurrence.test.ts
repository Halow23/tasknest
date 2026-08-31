import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("recurring tasks", () => {
  it("accepts recurrenceRule on task create and update", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/drizzle/schema.ts", import.meta.url), "utf8");

    expect(schema).toContain('taskRecurrenceRule = ["none", "daily", "weekly", "monthly"]');
    expect(source).toContain("recurrenceRule: taskRecurrenceSchema.optional()");
    expect(source).toContain("recurrenceRule: input.recurrenceRule ?? \"none\"");
    expect(source).toContain("...(input.recurrenceRule !== undefined ? { recurrenceRule: input.recurrenceRule } : {})");
  });

  it("spawns the next instance on completion with due-date math", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("async function spawnRecurringTask(");
    expect(source).toContain("function advanceDueDate(");
    expect(source).toContain('if (rule === "daily") next.setDate(next.getDate() + 1);');
    expect(source).toContain('if (rule === "weekly") next.setDate(next.getDate() + 7);');
    expect(source).toContain('if (rule === "monthly") next.setMonth(next.getMonth() + 1);');
    expect(source).toContain("spawnedTaskId = await spawnRecurringTask(input.taskId, result.project.workspaceId, completedAt!);");
    expect(source).toContain("recurrence_spawned");
  });

  it("copies assignees, labels, fields, and subtasks to the spawned instance", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain("if (assigneeRows.length) await db.insert(taskAssignees).values(assigneeRows.map(row => ({ taskId: nextTaskId, userId: row.userId })));");
    expect(source).toContain("if (labelRows.length) await db.insert(taskLabels).values(labelRows.map(row => ({ taskId: nextTaskId, labelId: row.labelId })));");
    expect(source).toContain("if (fieldRows.length) await db.insert(taskFieldValues).values(fieldRows.map(row => ({ taskId: nextTaskId, fieldId: row.fieldId, value: row.value })));");
    expect(source).toContain("completed: false, sortOrder: row.sortOrder })));");
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
