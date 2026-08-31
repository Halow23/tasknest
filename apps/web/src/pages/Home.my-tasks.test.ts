import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("my tasks view", () => {
  it("exposes a personal cross-project query returning only open assigned tasks", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("myTasks: protectedProcedure.query");
    expect(source).toContain("eq(taskAssignees.userId, ctx.user.id)");
    expect(source).toContain("is null`, eq(projects.workspaceId, workspace.id), eq(projects.archived, false)");
    expect(source).toContain("orderBy(sql");
  });

  it("renders the My tasks view with urgency buckets in the sidebar and tabs", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const view = await readFile(new URL("./home/MyTasksView.tsx", import.meta.url), "utf8");

    expect(home).toContain('value: "mytasks" as View');
    expect(home).toContain('<TabsTrigger value="mytasks"');
    expect(home).toContain("<MyTasksView tasks={(myTasksQuery.data ?? []) as MyTask[]}");
    expect(view).toContain('aria-label={meta.title}');
    expect(view).toContain('"overdue"');
    expect(view).toContain("bucketOf(task.dueAt)");
  });
});
