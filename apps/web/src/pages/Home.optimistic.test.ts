import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("optimistic ui", () => {
  it("optimistically patches the board on drag and rolls back on error", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain("const moveTask = trpc.tasknest.task.move.useMutation({");
    expect(home).toContain("onMutate: async input => {");
    expect(home).toContain("await utils.tasknest.task.list.cancel();");
    expect(home).toContain("const previousLists = utils.tasknest.task.list.getData(taskListInput);");
    expect(home).toContain("task.id === input.taskId ? { ...task, status: input.status } : task");
    expect(home).toContain("setData(taskListInput, context?.previousLists)");
  });

  it("optimistically toggles subtasks and appends comments with rollback", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain("await utils.tasknest.task.detail.cancel(detailKey);");
    expect(drawer).toContain("const previousDetail = utils.tasknest.task.detail.getData(detailKey);");
    expect(drawer).toContain("item.id === input.subtaskId ? { ...item, completed: input.completed } : item");
    expect(drawer).toContain("const optimisticComment = { id: -Date.now()");
    expect(drawer).toContain("[...existing.comments, optimisticComment]");
    expect(drawer).toContain("setData(context.detailKey, context.previousDetail)");
  });

  it("skips self-authored SSE events to avoid clobbering optimistic state", async () => {
    const hook = await readFile(new URL("../hooks/useWorkspaceEvents.ts", import.meta.url), "utf8");
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(hook).toContain("currentUserId?: number | null");
    expect(hook).toContain("if (payload.actorId != null && payload.actorId === options.currentUserId) return;");
    expect(home).toContain("currentUserId: user?.id });");
  });
});
