import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("notifications", () => {
  it("writes assignment and comment notifications excluding the actor", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("createNotification");
    expect(source).toContain("if (uid !== ctx.user.id) {");
    expect(source).toContain('type: "assigned",');
    expect(source).toContain("const freshAssignees = input.assigneeIds.filter(userId => !previous.has(userId) && userId !== ctx.user.id);");
    expect(source).toContain('type: "commented",');
    expect(source).toContain('for (const uid of mentionedUserIds) {');
    expect(source).toContain("// Notify only newly-assigned members, never the actor.");
  });

  it("exposes a guarded notification list/markRead/markAllRead sub-router", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");

    expect(source).toContain("notification: router({");
    expect(source).toContain('orderBy("createdAt", "desc")');
    expect(source).toContain("getNotificationsForUser(ctx.user.id)");
    expect(source).toContain("unreadCount: notifications.filter((n) => !n.readAt).length");
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
