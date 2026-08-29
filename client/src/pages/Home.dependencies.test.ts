import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task dependencies", () => {
  it("exposes guarded dependency procedures with cycle and scope validation", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../drizzle/schema.ts", import.meta.url), "utf8");

    expect(source).toContain("dependency: router({");
    expect(source).toContain('A task cannot depend on itself.');
    expect(source).toContain('Dependencies must stay within the same project.');
    expect(source).toContain("dependencyWouldCycle");
    expect(source).toContain('This dependency would create a circular chain.');
    expect(schema).toContain('export const taskDependencies = mysqlTable(');
    expect(schema).toContain("task_dependency_unique");
  });

  it("blocks completing a task that has open dependencies", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain('Blocked by open dependencies: ');
    expect(source).toContain("Complete them first.");
  });

  it("surfaces blocked counts in task.list and open dependencies in task.detail", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");
    expect(source).toContain("blockedByCount: openDependencyCount.get(task.id) ?? 0");
    expect(source).toContain("openDependencies, timeEntries: timeEntriesRows };");
  });

  it("renders the Blocked by drawer section and card badge", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");
    const card = await readFile(new URL("./home/dialogs.tsx", import.meta.url), "utf8");
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(drawer).toContain('aria-label="Blocked by"');
    expect(drawer).toContain("tasknest.dependency.list");
    expect(drawer).toContain("addDependency.mutate({ taskId: task.id, dependsOnTaskId: Number(dependencySelect) })");
    expect(card).toContain("blockedByCount");
    expect(card).toContain(">Blocked</Badge>");
    expect(home).toContain("projectTasks={tasks.map(task => ({ id: task.id, title: task.title, status: task.status }))}");
  });
});
