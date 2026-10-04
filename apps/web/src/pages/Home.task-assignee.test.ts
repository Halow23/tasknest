import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("new task assignment", () => {
  it("renders a teammate selector and includes the selected member in task creation", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const composer = await readFile(new URL("./home/TaskComposer.tsx", import.meta.url), "utf8");

    // The picker lives in the composer as a collapsed popover; Home holds the
    // selection and turns it into assigneeIds on submit.
    expect(composer).toContain("onAssigneeChange");
    expect(composer).toContain("members.map(member => (");
    expect(composer).toContain("onAssigneeChange(String(member.id))");
    expect(home).toContain("onAssigneeChange={setTaskAssigneeId}");
    expect(home).toContain('taskAssigneeId && taskAssigneeId !== "unassigned" ? [taskAssigneeId] : []');
  });
});
