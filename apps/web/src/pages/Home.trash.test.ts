import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("soft delete, trash, undo", () => {
  it("soft-deletes with activity logging and exposes restore/purge/trash procedures", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/drizzle/schema.ts", import.meta.url), "utf8");

    expect(source).toContain("set({ deletedAt: new Date() })");
    expect(source).toContain('action: "task_deleted"');
    expect(source).toContain('action: "project_deleted"');
    expect(source).toContain("trash: router({");
    expect(source).toContain("purgeTask: protectedProcedure.input");
    expect(source).toContain("purgeProject: protectedProcedure.input");
    expect(schema).toContain('deletedAt: timestamp("deletedAt")');
  });

  it("hides soft-deleted rows from every read path", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const db = await readFile(new URL("../../../api/src/db.ts", import.meta.url), "utf8");

    expect(db).toContain("and(eq(tasks.id, taskId), isNull(tasks.deletedAt))");
    expect(source).toContain("const conditions = [eq(tasks.projectId, project.id), isNull(tasks.deletedAt)]");
    expect(source).toContain("isNull(tasks.deletedAt), sql`${tasks.completedAt} is null`");
    expect(source).toContain("isNull(projects.deletedAt)");
  });

  it("purges expired items past the 30-day retention window", async () => {
    const trash = await readFile(new URL("../../../api/src/trash.ts", import.meta.url), "utf8");
    expect(trash).toContain("TRASH_RETENTION_DAYS = 30");
    expect(trash).toContain("cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)");
    expect(trash).toContain("db.delete(projects).where(lt(projects.deletedAt, cutoff))");
  });

  it("offers sidebar trash with restore/delete-forever and undo toasts", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");
    const dialogs = await readFile(new URL("./home/dialogs.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Trash"');
    expect(home).toContain("<TrashTaskRow key={task.id}");
    expect(home).toContain('label: "Undo", onClick: () => restoreProject.mutate({ projectId: deletedId })');
    expect(drawer).toContain('label: "Undo", onClick: () => restoreMutation.mutate({ taskId: result.deletedTaskId })');
    expect(dialogs).toContain("export function TrashTaskRow(");
  });
});
