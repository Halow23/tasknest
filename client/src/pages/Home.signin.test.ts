import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("TaskNest sign-in brand lockup", () => {
  it("renders the requested author credit beside the TaskNest logo as semantic content", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    expect(source).toContain('className="flex items-center gap-3"');
    expect(source).toContain('alt="TaskNest"');
    expect(source).toContain("TaskNest</p><p");
    expect(source).toContain("by Rafael Udtohan of Team Synapse");
  });
});
