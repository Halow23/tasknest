import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("new task assignment", () => {
  it("renders a teammate selector and includes the selected member in task creation", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('id="task-assignee"');
    expect(source).toContain("members.map(member => <SelectItem");
    expect(source).toContain("onValueChange={setTaskAssigneeId}");
    expect(source).toContain('taskAssigneeId && taskAssigneeId !== "unassigned" ? [taskAssigneeId] : []');
  });
});
