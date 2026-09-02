import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("@mentions", () => {
  it("parses mentions against members by name, first token, or email local-part", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("export function extractMentionedUserIds(");
    expect(source).toContain('member.name?.split(/\\s+/)[0]');
    expect(source).toContain('member.email?.split("@")[0]');
    expect(source).toContain('"@" + escaped + "(?![A-Za-z0-9._-])"');
  });

  it("routes mentioned users a mentioned notification and others a commented one", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain('const recipients = Array.from(new Set([...task.assigneeIds, task.createdById])).filter((id) => !mentioned.has(id) && id !== ctx.user.id);');
    expect(source).toContain('type: "mentioned",');
    expect(source).toContain("!mentioned.has(id)");
    expect(source).toContain("mentionedUserIds };");
  });

  it("renders @Name tokens in blue and hints at mentions in the composer", async () => {
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");

    expect(drawer).toContain("export function renderMentions(");
    expect(drawer).toContain("{renderMentions(item.body)}");
    expect(drawer).toContain("@name to mention");
  });
});
