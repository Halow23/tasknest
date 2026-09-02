export type KanbanStatus = "backlog" | "progress" | "review" | "done";

export type NavigableTask = {
  id: string;
  status: KanbanStatus;
};

const lanes: KanbanStatus[] = ["backlog", "progress", "review", "done"];

/**
 * Return the task that directional board navigation should focus, if any.
 * Horizontal movement keeps the relative card position where possible.
 */
export function getKanbanNextTaskId(tasks: NavigableTask[], currentTaskId: string | null, key: string) {
  const current = tasks.find(task => task.id === currentTaskId);
  if (!current) return null;

  const currentLane = tasks.filter(task => task.status === current.status);
  const currentIndex = currentLane.findIndex(task => task.id === current.id);

  if (key === "ArrowUp" || key === "ArrowDown") {
    return currentLane[currentIndex + (key === "ArrowUp" ? -1 : 1)]?.id ?? null;
  }

  if (key === "ArrowLeft" || key === "ArrowRight") {
    const laneIndex = lanes.indexOf(current.status);
    const nextLane = lanes[laneIndex + (key === "ArrowLeft" ? -1 : 1)];
    if (!nextLane) return null;
    const candidates = tasks.filter(task => task.status === nextLane);
    return candidates[Math.min(currentIndex, Math.max(0, candidates.length - 1))]?.id ?? null;
  }

  return null;
}
