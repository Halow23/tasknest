import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("ui fixes round", () => {
  it("renders the board without a duplicate grid wrapper so lanes fill the width", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const board = await readFile(new URL("./home/BoardView.tsx", import.meta.url), "utf8");

    // the only grid-cols-4 lane grid must live inside BoardView, not wrapped around it
    expect(board).toContain('grid min-w-[880px] grid-cols-4 gap-4');
    expect(home).not.toContain('<div className="grid min-w-[880px] grid-cols-4 gap-4"><BoardView');
    expect(home).toContain('view === "board" ? <BoardView tasks={tasks}');
    expect(home).not.toContain('onNewTask={() => setNewTaskOpen(true)} /></>');
  });

  it("positions quick-add in the toolbar row with a parse preview strip", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Quick add task"');
    expect(home).toContain("md:max-w-xl");
    expect(home).toContain('aria-label="Quick add preview"');
    // no longer a standalone full-width bar inside the board branch
    expect(home).not.toContain('view === "board" ? <><div className="border-b border-[#E2EBF0]');
  });

  it("assigns teammates from the edit task dialog", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain('<SelectTrigger id="edit-assignee"');
    expect(drawer).toContain('setEditAssigneeId(task.assignees[0] ? String(task.assignees[0].id) : "unassigned")');
    expect(drawer).toContain('assigneeIds: editAssigneeId !== "unassigned" ? [Number(editAssigneeId)] : []');
  });
});
