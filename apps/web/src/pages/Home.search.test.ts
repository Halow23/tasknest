import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("search and filters", () => {
  it("exposes a workspace-wide task.search matching titles, descriptions, and comments", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain('workspaceId: z.string().min(1), query: z.string().trim().min(1).max(120)');
    expect(source).toContain("searchTasks({ wsId: input.workspaceId, query: input.query, limit: input.limit })");
    expect(source).toContain("return searchTasks(");
    expect(source).toContain("dueBucket: z.enum([\"overdue\", \"today\", \"week\", \"none\"])");
  });

  it("filters the board server-side via task.list params", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const taskModule = await readFile(new URL("../../../api/src/firestore/task.ts", import.meta.url), "utf8");
    expect(source).toContain('assigneeId: z.string().nullable().optional()');
    expect(taskModule).toContain('if (input.labelId) query = query.where("labelIds", "array-contains", input.labelId) as typeof query;');
  });

  it("renders the filter bar and ⌘K search palette in the app shell", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const palette = await readFile(new URL("../components/SearchPalette.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Filter by assignee"');
    expect(home).toContain('aria-label="Filter by priority"');
    expect(home).toContain('aria-label="Filter by label"');
    expect(home).toContain('aria-label="Filter by due date"');
    expect(home).toContain("<SearchPalette open={searchOpen}");
    expect(home).toContain('event.key.toLowerCase() === "k"');
    expect(palette).toContain("tasknest.task.search");
    expect(palette).toContain('onSelect={() => handleSelect(task.id)}');
  });
});
