import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("timeline view", () => {
  it("computes clamped bar positions with done/overdue/blocked styling", async () => {
    const source = await readFile(new URL("./home/timelineMath.ts", import.meta.url), "utf8");

    expect(source).toContain("export function timelineBarPercents(");
    expect(source).toContain("isOverdue: hasDue && new Date(task.dueAt!).getTime() < now.getTime() && task.status !== \"done\"");
    expect(source).toContain("isBlocked: (task.blockedByCount ?? 0) > 0");
    expect(source).toContain("Math.min(100, Math.max(0,");
    expect(source).toContain(".sort((a, b) => Number(a.dueAt ?? Infinity) - Number(b.dueAt ?? Infinity))");
  });

  it("registers a Timeline view in the sidebar, tabs, and view switch", async () => {
    const home = await readFile(new URL("./Home.tsx", import.meta.url), "utf8");
    const types = await readFile(new URL("./home/types.ts", import.meta.url), "utf8");
    const view = await readFile(new URL("./home/TimelineView.tsx", import.meta.url), "utf8");

    expect(types).toContain('"timeline"');
    expect(home).toContain('{ label: "Timeline", icon: CalendarRange, value: "timeline" as View }');
    expect(home).toContain('<TabsTrigger value="timeline"');
    expect(home).toContain('<TimelineView tasks={tasks} onOpenTask={(taskId: string) => setSelectedTaskId(taskId)} />');
    expect(view).toContain('aria-label="Task timeline"');
    expect(view).toContain("timelineBarPercents(tasks)");
  });
});
