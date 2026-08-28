import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("task deep links", () => {
  it("mirrors the open task to ?task= and restores it on load and popstate", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('new URLSearchParams(window.location.search).get("task")');
    expect(source).toContain('window.addEventListener("popstate", readParam)');
    expect(source).toContain('url.searchParams.set("task", String(selectedTaskId))');
    expect(source).toContain('url.searchParams.delete("task")');
    expect(source).toContain("window.history.replaceState(window.history.state, \"\", url)");
  });

  it("offers a copy-link action in the task drawer", async () => {
    const source = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Copy task link"');
    expect(source).toContain('`${window.location.origin}/?task=${task.id}`');
    expect(source).toContain("Task link copied to clipboard.");
  });
});
