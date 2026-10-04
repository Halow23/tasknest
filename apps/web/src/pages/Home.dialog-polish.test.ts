import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("dialog polish round", () => {
  it("confirms before signing out", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain("<AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>");
    expect(home).toContain("Sign out of TaskNest?");
    expect(home).toContain("<AlertDialogAction onClick={() => logout()}>Sign out</AlertDialogAction>");
    expect(home).not.toContain("<button onClick={() => logout()}");
  });

  it("collects priority and due date when creating a task", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const composer = await readFile(new URL("./home/TaskComposer.tsx", import.meta.url), "utf8");

    // Both properties are collapsed pickers in the composer.
    expect(composer).toContain("<DueDatePicker id=\"task-due\" value={dueDate} onChange={onDueDateChange} />");
    expect(composer).toContain("onPriorityChange");
    expect(composer).toContain("priorityStyle[value]");
    expect(home).toContain("priority: newTaskPriority");
    expect(home).toContain("dueAt: newTaskDueDate ? new Date(`${newTaskDueDate}T12:00:00`) : null");
    expect(home).toContain('setNewTaskPriority("medium");');
  });
});
