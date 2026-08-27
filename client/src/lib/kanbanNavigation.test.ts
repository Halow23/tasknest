import { describe, expect, it } from "vitest";
import { getKanbanNextTaskId } from "./kanbanNavigation";

const tasks = [
  { id: 1, status: "backlog" as const },
  { id: 2, status: "backlog" as const },
  { id: 3, status: "progress" as const },
  { id: 4, status: "review" as const },
  { id: 5, status: "review" as const },
];

describe("getKanbanNextTaskId", () => {
  it("moves vertically within a lane", () => {
    expect(getKanbanNextTaskId(tasks, 1, "ArrowDown")).toBe(2);
    expect(getKanbanNextTaskId(tasks, 2, "ArrowUp")).toBe(1);
    expect(getKanbanNextTaskId(tasks, 1, "ArrowUp")).toBeNull();
  });

  it("moves horizontally while preserving a relative card position", () => {
    expect(getKanbanNextTaskId(tasks, 2, "ArrowRight")).toBe(3);
    expect(getKanbanNextTaskId(tasks, 3, "ArrowRight")).toBe(4);
    expect(getKanbanNextTaskId(tasks, 4, "ArrowLeft")).toBe(3);
  });

  it("leaves focus in place when the target lane or key is unavailable", () => {
    expect(getKanbanNextTaskId(tasks, 5, "ArrowRight")).toBeNull();
    expect(getKanbanNextTaskId(tasks, 1, "Enter")).toBeNull();
    expect(getKanbanNextTaskId(tasks, 999, "ArrowDown")).toBeNull();
  });
});

