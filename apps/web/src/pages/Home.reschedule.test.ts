import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("calendar drag-reschedule", () => {
  it("makes month-grid chips draggable with the shared dataTransfer pattern", async () => {
    const view = await readFile(new URL("./home/CalendarView.tsx", import.meta.url), "utf8");

    expect(view).toContain("draggable");
    expect(view).toContain('event.dataTransfer.setData("text/plain", String(task.id))');
    expect(view).toContain("drag to reschedule");
  });

  it("treats day cells as drop targets that trigger reschedule", async () => {
    const view = await readFile(new URL("./home/CalendarView.tsx", import.meta.url), "utf8");

    expect(view).toContain("onDragOver={event => event.preventDefault()}");
    expect(view).toContain('const id = event.dataTransfer.getData("text/plain"); if (id) onReschedule(id, key);');
    expect(view).toContain("onReschedule: (taskId: string, dateKey: string) => void;");
  });

  it("reschedules through task.update with optimistic rollback", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");

    expect(home).toContain("const rescheduleTask = trpc.tasknest.task.update.useMutation({");
    expect(home).toContain('onReschedule={(taskId, dateKey) => rescheduleTask.mutate({ taskId, workspaceId: workspace.id, dueAt: new Date(`${dateKey}T12:00:00`) })}');
    expect(home).toContain("task.id === input.taskId ? { ...task, dueAt: input.dueAt ?? null } : task");
    expect(home).toContain("setData(taskListInput, context?.previousLists)");
  });
});
