import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("soft delete, trash, undo", () => {
  it("soft-deletes with activity logging and exposes restore/purge/trash procedures", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const schema = await readFile(new URL("../../../api/src/firestore/types.ts", import.meta.url), "utf8");

    expect(source).toContain("softDeleteTask(input.workspaceId, input.taskId)");
    expect(source).toContain('action: "task_deleted"');
    expect(source).toContain('action: "project_deleted"');
    expect(source).toContain("trash: router({");
    expect(source).toContain("purgeTask: protectedProcedure");
    expect(source).toContain("purgeProject: protectedProcedure");
    expect(schema).toContain("deletedAt: Date | null;");
  });

  it("hides soft-deleted rows from every read path", async () => {
    const source = await readFile(new URL("../../../api/src/routers/tasknest.ts", import.meta.url), "utf8");
    const task = await readFile(new URL("../../../api/src/firestore/task.ts", import.meta.url), "utf8");

    expect(task).toContain('if (!task || task.deletedAt) throw new TRPCError');
    expect(task).toContain('.where("deletedAt", "==", null)');
    expect(task).toContain('if (!task || task.deletedAt)');
    expect(source).toContain('projectsCol(fs, ws.id).where("deletedAt", "==", null)');
  });

  it("purges expired items past the 30-day retention window", async () => {
    const trash = await readFile(new URL("../../../api/src/trash.ts", import.meta.url), "utf8");
    expect(trash).toContain("TRASH_RETENTION_DAYS = 30");
    expect(trash).toContain("cutoff.setDate(cutoff.getDate() - TRASH_RETENTION_DAYS)");
    expect(trash).toContain("projsSnap.docs.forEach((d) => batch.delete(d.ref))");
  });

  it("offers sidebar trash with restore/delete-forever and undo toasts", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const drawer = await readFile(new URL("./home/TaskDrawer.tsx", import.meta.url), "utf8");
    const dialogs = await readFile(new URL("./home/dialogs.tsx", import.meta.url), "utf8");

    expect(home).toContain('aria-label="Trash"');
    expect(home).toContain("<TrashTaskRow key={task.id}");
    expect(home).toContain('label: "Undo", onClick: () => restoreProject.mutate({ projectId: deletedId, workspaceId: variables.workspaceId })');
    expect(drawer).toContain('label: "Undo", onClick: () => restoreMutation.mutate({ taskId: result.deletedTaskId, workspaceId })');
    expect(dialogs).toContain("export function TrashTaskRow(");
  });
});
