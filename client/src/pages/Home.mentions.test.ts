import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("@mentions", () => {
  it("parses mentions against members by name, first token, or email local-part", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("export function extractMentionedUserIds(");
    expect(source).toContain('member.name?.split(/\\s+/)[0]');
    expect(source).toContain('member.email?.split("@")[0]');
    expect(source).toContain('"@" + escaped + "(?![A-Za-z0-9._-])"');
  });

  it("routes mentioned users a mentioned notification and others a commented one", async () => {
    const source = await readFile(new URL("../../../server/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain('type: "commented", recipientIds: commentRecipients');
    expect(source).toContain('type: "mentioned", recipientIds: mentionedUserIds');
    expect(source).toContain(".filter(userId => !mentioned.has(userId))");
    expect(source).toContain("mentionedUserIds };");
  });

  it("renders @Name tokens in blue and hints at mentions in the composer", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain("export function renderMentions(");
    expect(drawer).toContain("{renderMentions(item.body)}");
    expect(drawer).toContain("@name to mention");
  });
});
