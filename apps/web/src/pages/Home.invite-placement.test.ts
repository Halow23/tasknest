import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("invite button placement", () => {
  it("renders the invite control inline beside the delete project button in the toolbar", async () => {
    const source = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(source).toContain('<InviteTeammatesButton variant="outline" size="sm"');
    expect(source.indexOf("<InviteTeammatesButton")).toBeGreaterThan(-1);
    expect(source.indexOf("<InviteTeammatesButton")).toBeLessThan(source.indexOf("Delete project"));
    expect(source).toContain('onClick={() => setProjectDeleteOpen(true)}');
  });

  it("keeps the invite dialog as an inline component without fixed positioning", async () => {
    const source = await readFile(new URL("../components/WorkspaceInviteControl.tsx", import.meta.url), "utf8");

    expect(source).toContain("export function InviteTeammatesButton");
    expect(source).toContain('aria-label="Invite teammates to this workspace"');
    expect(source).not.toContain("fixed bottom-4 right-4");
  });
});
