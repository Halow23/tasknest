import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("workload view", () => {
  it("inverts assignee data into per-member load ordered by open work", async () => {
    const source = await readFile(new URL("./home/workloadMath.ts", import.meta.url), "utf8");

    expect(source).toContain("export function groupWorkload(");
    expect(source).toContain("entry.open += 1;");
    expect(source).toContain("if (task.dueAt && new Date(task.dueAt) < now) entry.overdue += 1;");
    expect(source).toContain("if (task.priority === \"high\") entry.highPriority += 1;");
    expect(source).toContain("Array.from(byUser.values()).sort((a, b) => b.open - a.open || b.overdue - a.overdue)");
  });

  it("registers a Workload view fed by the board assignee data", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const types = await readFile(new URL("./home/types.ts", import.meta.url), "utf8");
    const view = await readFile(new URL("./home/WorkloadView.tsx", import.meta.url), "utf8");

    expect(types).toContain('"workload"');
    expect(home).toContain('{ label: "Workload", icon: UsersRound, value: "workload" as View }');
    expect(home).toContain('<TabsTrigger value="workload"');
    expect(home).toContain("userId: assignee.id");
    expect(view).toContain("groupWorkload(tasks, assignments, members)");
    expect(view).toContain('aria-label={`Workload for ${');
  });
});
