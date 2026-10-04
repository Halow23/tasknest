import { MoreHorizontal, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WorkspaceLabel } from '@/components/LabelPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TaskCard } from './dialogs';
import { columns, type Member, type Status, type TaskSummary } from './types';

/** A column is over its limit when it holds more cards than the limit allows. */
function isOverLimit(count: number, limit: number | undefined) {
  return limit !== undefined && count > limit;
}

export function BoardView({ tasks, assigneeMap, labelMap, focusedTaskId, moveTask, reorderTask, projectId, workspaceId, wipLimits, onSetWipLimit, onFocusTask, onOpenTask, onNewTask }: {
  tasks: TaskSummary[];
  assigneeMap: Map<string, Member[]>;
  labelMap: Map<string, WorkspaceLabel[]>;
  focusedTaskId: string | null;
  moveTask: { mutate: (input: { taskId: string; workspaceId: string; status: TaskSummary['status'] }) => void };
  reorderTask: { mutate: (input: { projectId: string; workspaceId: string; status: TaskSummary['status']; orderedTaskIds: string[] }) => void };
  projectId: string;
  workspaceId: string;
  wipLimits?: Partial<Record<Status, number>>;
  onSetWipLimit: (status: Status, limit: number | null) => void;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onNewTask: (status?: TaskSummary['status']) => void;
}) {
  return (
    <div className="flex-1 overflow-x-auto overscroll-x-contain px-6 py-6 lg:pe-7">
      <div className="grid h-full w-max grid-flow-col auto-cols-[273px] gap-2">
        {columns.map(column => {
          const lane = tasks.filter(task => task.status === column.id);
          const limit = wipLimits?.[column.id];
          const over = isOverLimit(lane.length, limit);
          return (
            <section
              key={column.id}
              onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) moveTask.mutate({ taskId: id, workspaceId, status: column.id }); }}
              className="kanban-lane relative flex h-full min-h-0 flex-col overflow-hidden rounded-tn-column bg-tn-surface-column pt-3 ring-2 ring-transparent ring-inset transition-[box-shadow,background-color]"
            >
              <header className="flex h-5 shrink-0 items-center justify-between px-3">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate text-tn-body font-medium text-foreground">{column.title}</h2>
                  <span
                    className={cn("shrink-0 text-tn-body font-medium", over ? "text-tn-danger" : "text-tn-text-secondary")}
                    title={over ? `${lane.length} cards — over the limit of ${limit}` : limit !== undefined ? `Limit ${limit}` : undefined}
                  >
                    {lane.length}{limit !== undefined && `/${limit}`}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Set WIP limit for ${column.title}`}
                        className="grid size-5 place-items-center rounded-md text-tn-text-secondary transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tn-accent"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-3">
                      <label htmlFor={`wip-${column.id}`} className="text-tn-body-2 font-medium text-foreground">WIP limit</label>
                      <p className="mt-0.5 text-tn-caption-1 text-tn-text-secondary">Flag the column once it holds more than this. Work is never blocked.</p>
                      <input
                        id={`wip-${column.id}`}
                        type="number"
                        min={1}
                        max={999}
                        defaultValue={limit ?? ""}
                        placeholder="No limit"
                        onChange={event => {
                          const raw = event.target.value.trim();
                          onSetWipLimit(column.id, raw === "" ? null : Math.max(1, Math.min(999, Number(raw))));
                        }}
                        className="mt-2 h-8 w-full rounded-tn-control border border-border bg-background px-2 text-tn-body-2 outline-none focus-visible:ring-2 focus-visible:ring-tn-accent"
                      />
                    </PopoverContent>
                  </Popover>
                  <button
                    type="button"
                    onClick={() => onNewTask(column.id)}
                    aria-label={`Add task to ${column.title}`}
                    className="grid size-5 place-items-center rounded-md text-tn-text-secondary transition-colors hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tn-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>
              <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-1.5 pb-1.5">
                {lane.map(task => (
                  <div
                    key={task.id}
                    onDragOver={event => { event.preventDefault(); event.stopPropagation(); }}
                    onDrop={event => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (!id || id === task.id) return; const dragged = lane.find(item => item.id === id); const without = lane.filter(item => item.id !== id); const targetIndex = without.findIndex(item => item.id === task.id); const next = [...without]; next.splice(dragged && lane.indexOf(dragged) < (lane.indexOf(task)) ? targetIndex + 1 : targetIndex, 0, { id } as TaskSummary); reorderTask.mutate({ projectId, workspaceId, status: column.id, orderedTaskIds: next.map(item => item.id) }); }}
                  >
                    <TaskCard task={task} members={assigneeMap.get(task.id) ?? []} labels={labelMap.get(task.id) ?? []} focused={focusedTaskId === task.id} onFocus={() => onFocusTask(task.id)} onOpen={() => onOpenTask(task.id)} onDragStart={event => event.dataTransfer.setData("text/plain", String(task.id))} />
                  </div>
                ))}
              </div>
              <button
                onClick={() => onNewTask(column.id)}
                className="mx-1.5 mb-1.5 flex w-[calc(100%-0.75rem)] shrink-0 items-center gap-2 rounded-tn-control px-2 py-2 text-tn-body-2 font-medium text-tn-text-secondary transition-colors hover:bg-black/5 hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />Add task
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
