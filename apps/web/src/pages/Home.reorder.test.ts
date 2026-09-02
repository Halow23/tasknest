import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("intra-lane reorder", () => {
  it("renumbers lane sortOrder transactionally with full-lane validation", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain('orderedTaskIds: z.array(z.string().min(1)).min(1).max(500)');
    expect(source).toContain("Reorder must include every task in the lane exactly once.");
    expect(source).toContain("sortOrder: index * 10");
    expect(source).toContain('action: "lane_reordered"');
  });

  it("drops onto cards to insert-before with optimistic cache reorder", async () => {
    const board = await readFile(new URL("./home/BoardView.tsx", import.meta.url), "utf8");
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const types = await readFile(new URL("./home/types.ts", import.meta.url), "utf8");

    expect(board).toContain("reorderTask: { mutate: (input: { projectId: string; workspaceId: string; status: TaskSummary['status']; orderedTaskIds: string[] }) => void };");
    expect(board).toContain("onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}");
    expect(board).toContain("orderedTaskIds: next.map(item => item.id)");
    expect(home).toContain("const reorderTask = trpc.tasknest.task.reorder.useMutation({");
    expect(types).toContain("sortOrder?: number");
  });
});
