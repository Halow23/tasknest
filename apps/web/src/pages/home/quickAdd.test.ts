import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

describe("quick-add parser", () => {
  const now = new Date(2026, 7, 28, 10, 0, 0); // Sat 2026-08-28, local

  it("parses today and tomorrow phrases", () => {
    expect(parseQuickAdd("Submit report today", now).dueDateKey).toBe("2026-08-28");
    expect(parseQuickAdd("Submit report today", now).title).toBe("Submit report");
    expect(parseQuickAdd("Call vendor tomorrow", now).dueDateKey).toBe("2026-08-29");
  });

  it("parses next week, in-N-days, and weekday names", () => {
    expect(parseQuickAdd("Plan sprint next week", now).dueDateKey).toBe("2026-09-04");
    expect(parseQuickAdd("Ship build in 3 days", now).dueDateKey).toBe("2026-08-31");
    // next monday from Saturday = +2 days
    expect(parseQuickAdd("Kickoff monday", now).dueDateKey).toBe("2026-08-31");
    // tomorrow is Saturday, so it resolves to tomorrow, not next week
    expect(parseQuickAdd("Demo saturday", now).dueDateKey).toBe("2026-08-29");
  });

  it("parses priority tokens and recurrence phrases", () => {
    const parsed = parseQuickAdd("Design review !high every week", now);
    expect(parsed.priority).toBe("high");
    expect(parsed.recurrence).toBe("weekly");
    expect(parsed.title).toBe("Design review");
    expect(parseQuickAdd("Fix bug p1", now).priority).toBe("high");
    expect(parseQuickAdd("Water plants every day", now).recurrence).toBe("daily");
  });

  it("strips time tokens and treats leftovers as the title", () => {
    const parsed = parseQuickAdd("Standup notes tomorrow 5pm", now);
    expect(parsed.title).toBe("Standup notes");
    expect(parsed.dueDateKey).toBe("2026-08-29");
  });

  it("falls back to a plain title when nothing parses", () => {
    const parsed = parseQuickAdd("Just a plain task", now);
    expect(parsed.title).toBe("Just a plain task");
    expect(parsed.dueDateKey).toBeNull();
    expect(parsed.priority).toBeNull();
    expect(parsed.recurrence).toBe("none");
  });
});
