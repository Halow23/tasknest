import type { Priority } from "./types";

export type ParsedQuickAdd = {
  title: string;
  dueDateKey: string | null;
  priority: Priority | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
};

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function calendarKeyFor(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Parses quick-add input: a due date phrase (today/tomorrow/next week/
 * weekday/in N days), an optional time (5pm / 17:00), a priority token
 * (!high/!medium/!low or p1/p2/p3), a recurrence phrase (every day/week/
 * month), and the remaining words become the title. Time is currently
 * folded into the date (time-of-day scheduling is a future enhancement).
 */
export function parseQuickAdd(input: string, now = new Date()): ParsedQuickAdd {
  const result: ParsedQuickAdd = { title: "", dueDateKey: null, priority: null, recurrence: "none" };
  let text = input.trim();
  if (!text) return result;

  // priority
  const priorityPatterns: [RegExp, Priority][] = [
    [/!high\b/i, "high"], [/!medium\b/i, "medium"], [/!low\b/i, "low"],
    [/\bp1\b/i, "high"], [/\bp2\b/i, "medium"], [/\bp3\b/i, "low"],
  ];
  for (const [pattern, priority] of priorityPatterns) {
    if (pattern.test(text)) { result.priority = priority; text = text.replace(pattern, " "); break; }
  }

  // recurrence
  if (/\bevery\s+day\b/i.test(text)) { result.recurrence = "daily"; text = text.replace(/\bevery\s+day\b/i, " "); }
  else if (/\bevery\s+week\b/i.test(text)) { result.recurrence = "weekly"; text = text.replace(/\bevery\s+week\b/i, " "); }
  else if (/\bevery\s+month\b/i.test(text)) { result.recurrence = "monthly"; text = text.replace(/\bevery\s+month\b/i, " "); }

  // date phrases
  const setDate = (date: Date) => { result.dueDateKey = calendarKeyFor(date); };
  const dayMatch = /\bin\s+(\d{1,2})\s+days?\b/i.exec(text);
  const weekdayMatch = /\b(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text);

  if (/\btoday\b/i.test(text)) { setDate(now); text = text.replace(/\btoday\b/i, " "); }
  else if (/\btomorrow\b/i.test(text)) { const date = new Date(now); date.setDate(date.getDate() + 1); setDate(date); text = text.replace(/\btomorrow\b/i, " "); }
  else if (/\bnext\s+week\b/i.test(text)) { const date = new Date(now); date.setDate(date.getDate() + 7); setDate(date); text = text.replace(/\bnext\s+week\b/i, " "); }
  else if (dayMatch) { const date = new Date(now); date.setDate(date.getDate() + Number(dayMatch[1])); setDate(date); text = text.replace(dayMatch[0], " "); }
  else if (weekdayMatch) {
    const target = WEEKDAYS.indexOf(weekdayMatch[1].toLowerCase());
    const date = new Date(now);
    let daysAhead = (target - date.getDay() + 7) % 7;
    if (daysAhead === 0) daysAhead = 7;
    date.setDate(date.getDate() + daysAhead);
    setDate(date);
    text = text.replace(weekdayMatch[0], " ");
  }

  // time tokens are recognized and stripped (folded into the due day)
  text = text.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i, " ").replace(/\b(?:at\s+)?\d{1,2}:\d{2}\b/, " ");

  result.title = text.replace(/\s+/g, " ").trim();
  return result;
}
