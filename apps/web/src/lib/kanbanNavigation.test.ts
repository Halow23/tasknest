import { describe, expect, it } from "vitest";
import { getKanbanNextTaskId } from "./kanbanNavigation";

// Lane order is backlog -> todo -> progress -> review -> done. Horizontal
// movement follows that order, so every adjacent pair needs a card for the
// ArrowLeft/ArrowRight assertions to resolve.
const tasks = [
  { id: 1, status: "backlog" as const },
  { id: 2, status: "backlog" as const },
  { id: 3, status: "todo" as const },
  { id: 4, status: "progress" as const },
  { id: 5, status: "review" as const },
  { id: 6, status: "review" as const },
  { id: 7, status: "done" as const },
];

describe("getKanbanNextTaskId", () => {
  it("moves vertically within a lane", () => {
    expect(getKanbanNextTaskId(tasks, 1, "ArrowDown")).toBe(2);
    expect(getKanbanNextTaskId(tasks, 2, "ArrowUp")).toBe(1);
    expect(getKanbanNextTaskId(tasks, 1, "ArrowUp")).toBeNull();
  });

  it("moves horizontally across all five lanes in order", () => {
    // backlog -> todo -> progress -> review -> done
    expect(getKanbanNextTaskId(tasks, 2, "ArrowRight")).toBe(3);
    expect(getKanbanNextTaskId(tasks, 3, "ArrowRight")).toBe(4);
    expect(getKanbanNextTaskId(tasks, 4, "ArrowRight")).toBe(5);
    expect(getKanbanNextTaskId(tasks, 5, "ArrowRight")).toBe(7);
    // and back. Card 3 is the only card in `todo`, so its index is 0 and
    // ArrowLeft lands on index 0 of `backlog` (card 1) rather than card 2.
    expect(getKanbanNextTaskId(tasks, 7, "ArrowLeft")).toBe(5);
    expect(getKanbanNextTaskId(tasks, 5, "ArrowLeft")).toBe(4);
    expect(getKanbanNextTaskId(tasks, 4, "ArrowLeft")).toBe(3);
    expect(getKanbanNextTaskId(tasks, 3, "ArrowLeft")).toBe(1);
  });

  it("preserves a relative card position when the target lane is shorter", () => {
    // Card 6 is the second card of `review` (index 1); `done` holds a single
    // card, so the index is clamped to it rather than dropped.
    expect(getKanbanNextTaskId(tasks, 6, "ArrowRight")).toBe(7);
    // Likewise card 6 -> `progress`, which has one card.
    expect(getKanbanNextTaskId(tasks, 6, "ArrowLeft")).toBe(4);
  });

  it("leaves focus in place when the target lane or key is unavailable", () => {
    expect(getKanbanNextTaskId(tasks, 7, "ArrowRight")).toBeNull();
    expect(getKanbanNextTaskId(tasks, 1, "ArrowLeft")).toBeNull();
    expect(getKanbanNextTaskId(tasks, 1, "Enter")).toBeNull();
    expect(getKanbanNextTaskId(tasks, 999, "ArrowDown")).toBeNull();
  });

  it("returns null when the adjacent lane is empty", () => {
    const gapped = [
      { id: 1, status: "backlog" as const },
      { id: 2, status: "progress" as const },
    ];
    // `todo` sits between them and holds no cards.
    expect(getKanbanNextTaskId(gapped, 1, "ArrowRight")).toBeNull();
  });
});
