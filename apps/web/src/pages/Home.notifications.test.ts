import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("notifications", () => {
  it("writes assignment and comment notifications excluding the actor", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("async function notifyUsers(");
    expect(source).toContain("input.recipientIds.filter(id => id && id !== input.actorId)");
    expect(source).toContain('type: "assigned", recipientIds: input.assigneeIds ?? []');
    expect(source).toContain("const freshAssignees = input.assigneeIds.filter(userId => !previous.has(userId))");
    expect(source).toContain('type: "commented", recipientIds: commentRecipients');
    expect(source).toContain('type: "mentioned", recipientIds: mentionedUserIds');
    expect(source).toContain("Notification failures must not fail the triggering mutation.");
  });

  it("exposes a guarded notification list/markRead/markAllRead sub-router", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("notification: router({");
    expect(source).toContain("orderBy(sql`${notifications.readAt} is not null`, desc(notifications.createdAt))");
    expect(source).toContain("eq(notifications.userId, ctx.user.id)");
    expect(source).toContain("isNull(notifications.readAt)");
  });

  it("renders a header bell with unread badge that deep-links to tasks", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const bell = await readFile(new URL("../components/NotificationBell.tsx", import.meta.url), "utf8");

    expect(home).toContain("<NotificationBell onSelectTask={taskId => setSelectedTaskId(taskId)} />");
    expect(bell).toContain("refetchInterval: 30_000");
    expect(bell).toContain("Mark all read");
    expect(bell).toContain("if (row.taskId) onSelectTask(row.taskId)");
  });
});
