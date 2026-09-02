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

    expect(home).toContain('id="task-priority"');
    expect(home).toContain("<DueDatePicker id=\"task-due\" value={newTaskDueDate} onChange={setNewTaskDueDate} />");
    expect(home).toContain("priority: newTaskPriority");
    expect(home).toContain("dueAt: newTaskDueDate ? new Date(`${newTaskDueDate}T12:00:00`) : null");
    expect(home).toContain('setNewTaskPriority("medium"); setNewTaskDueDate("");');
  });

  it("uses the shared shadcn Select for the prerequisite picker", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain('aria-label="Choose a prerequisite task"');
    expect(drawer).toContain('<SelectTrigger className="h-8 min-w-0 flex-1');
    expect(drawer).not.toContain("<select");
  });
});
