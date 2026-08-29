import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("quick-add bar", () => {
  it("renders above the board with a live parse preview and submits parsed values", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Quick add task"');
    expect(home).toContain("parseQuickAdd(quickAddText)");
    expect(home).toContain('priority: parsedQuickAdd.priority ?? "medium"');
    expect(home).toContain("dueAt: parsedQuickAdd.dueDateKey ? new Date(`${parsedQuickAdd.dueDateKey}T12:00:00`) : null");
    expect(home).toContain('aria-label="Quick add preview"');
  });
});
