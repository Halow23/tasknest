import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("WorkspaceInviteControl", () => {
  it("exposes invitation creation, direct delivery, mail-app fallback, pending tracking, and revocation controls", async () => {
    const source = await readFile(new URL("./WorkspaceInviteControl.tsx", import.meta.url), "utf8");

    expect(source).toContain("Invite teammates");
    expect(source).toContain("workspace-invite-email");
    expect(source).toContain("createInvite.mutate({ workspaceId, recipientEmail: email })");
    expect(source).toContain("/?invite=${createInvite.data.token}");
    expect(source).toContain("sendInviteEmail.mutate({ inviteId, appOrigin: window.location.origin })");
    expect(source).toContain("openMailApp");
    expect(source).toContain("mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}");
    expect(source).toContain("Open email app");
    expect(source).toContain("Pending invitations");
    expect(source).toContain("revokeInvite.mutate({ inviteId: invite.id })");
    expect(source).toContain("acceptInvite.mutate({ token: inviteToken })");
    expect(source).toContain("expires in 7 days");
  });
});
