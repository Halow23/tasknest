import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("quick-add bar (removed from UI, parser retained)", () => {
  it("renders above the board with a live parse preview and submits parsed values", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).not.toContain('aria-label="Quick add task"');
    expect(home).not.toContain("parseQuickAdd(quickAddText)");
  });
});
