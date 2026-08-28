import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Project calendar modes", () => {
  it("keeps the agenda list and exposes a navigable month grid", async () => {
    const source = await readFile(new URL("./home/CalendarView.tsx", import.meta.url), "utf8");

    expect(source).toContain('aria-label="Calendar view"');
    expect(source).toContain('aria-pressed={calendarMode === "list"}');
    expect(source).toContain('aria-pressed={calendarMode === "month"}');
    expect(source).toContain('aria-label={`${calendarMonthLabel} calendar`}');
    expect(source).toContain('aria-label="Previous month"');
    expect(source).toContain('aria-label="Next month"');
    expect(source).toContain("tasksByCalendarDate.get(key)");
  });
});
