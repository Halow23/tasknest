import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("ui fixes round", () => {
  it("renders the board without a duplicate grid wrapper so lanes fill the width", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const board = await readFile(new URL("./home/BoardView.tsx", import.meta.url), "utf8");

    // The lane grid must live inside BoardView, not be wrapped around it.
    // Columns are fixed-width and scroll horizontally, matching the reference.
    expect(board).toContain('grid h-full w-max grid-flow-col auto-cols-[273px] gap-2');
    expect(home).not.toContain('grid-flow-col auto-cols-[273px] gap-2"><BoardView');
    expect(home).toContain('view === "board" ? <BoardView tasks={tasks}');
    expect(home).not.toContain('onNewTask={() => setNewTaskOpen(true)} /></>');
  });

  it("positions quick-add in the toolbar row with a parse preview strip", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).not.toContain('aria-label="Quick add task"');
    expect(home).not.toContain('aria-label="Quick add preview"');
    // no longer a standalone full-width bar inside the board branch
    expect(home).not.toContain('view === "board" ? <><div className="border-b border-[#E2EBF0]');
  });

  it("assigns teammates from the edit task dialog", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain('<SelectTrigger id="edit-assignee"');
    expect(drawer).toContain('setEditAssigneeId(task.assignees[0] ? String(task.assignees[0].id) : "unassigned")');
    expect(drawer).toContain('assigneeIds: editAssigneeId !== "unassigned" ? [editAssigneeId] : []');
  });
});
