import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("WorkspaceInviteControl", () => {
  it("exposes a clear invitation action and securely uses the existing workspace invite procedures", async () => {
    const source = await readFile(new URL("./WorkspaceInviteControl.tsx", import.meta.url), "utf8");

    expect(source).toContain("Invite teammates");
    expect(source).toContain("createInvite.mutate({ workspaceId: workspace.id })");
    expect(source).toContain("/?invite=${createInvite.data.token}");
    expect(source).toContain("acceptInvite.mutate({ token: inviteToken })");
    expect(source).toContain("expires in 7 days");
  });
});
