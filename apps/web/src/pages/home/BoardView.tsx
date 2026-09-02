import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LabelChip, type WorkspaceLabel } from '@/components/LabelPicker';
import { TaskCard } from './dialogs';
import { columns, type Member, type TaskSummary } from './types';

export function BoardView({ tasks, assigneeMap, labelMap, focusedTaskId, moveTask, reorderTask, projectId, workspaceId, onFocusTask, onOpenTask, onNewTask }: {
  tasks: TaskSummary[];
  assigneeMap: Map<string, Member[]>;
  labelMap: Map<string, WorkspaceLabel[]>;
  focusedTaskId: string | null;
  moveTask: { mutate: (input: { taskId: string; workspaceId: string; status: TaskSummary['status'] }) => void };
  reorderTask: { mutate: (input: { projectId: string; workspaceId: string; status: TaskSummary['status']; orderedTaskIds: string[] }) => void };
  projectId: string;
  workspaceId: string;
  onFocusTask: (taskId: string) => void;
  onOpenTask: (taskId: string) => void;
  onNewTask: () => void;
}) {
  return <div className="flex-1 overflow-x-auto px-5 py-5 lg:px-7"><div className="grid min-w-[880px] grid-cols-4 gap-4">{columns.map(column => { const lane = tasks.filter(task => task.status === column.id); return <section key={column.id} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const id = event.dataTransfer.getData("text/plain"); if (id) moveTask.mutate({ taskId: id, workspaceId, status: column.id }); }} className="min-h-[520px] rounded-xl border-t border-[#DDE9EF] bg-[#F2F7FA] p-2.5"><header className="mb-3 flex items-start justify-between px-1.5 pt-1"><div><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", column.color)} /><h2 className="text-[13px] font-extrabold text-[#253B56]">{column.title}</h2><span className="text-[11px] font-bold text-[#8AA0AF]">{lane.length}</span></div><p className="mt-0.5 text-[10px] text-[#8B9EAA]">{column.note}</p></div></header><div className="space-y-2.5">{lane.map((task, position) => <div key={task.id} data-task-id={task.id} onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData("text/plain"); if (!id || id === task.id) return; const dragged = lane.find(item => item.id === id); const without = lane.filter(item => item.id !== id); const targetIndex = without.findIndex(item => item.id === task.id); const next = [...without]; next.splice(dragged && lane.indexOf(dragged) < (lane.indexOf(task)) ? targetIndex + 1 : targetIndex, 0, { id } as TaskSummary); reorderTask.mutate({ projectId, workspaceId, status: column.id, orderedTaskIds: next.map(item => item.id) }); }}><TaskCard task={task} members={assigneeMap.get(task.id) ?? []} labels={labelMap.get(task.id) ?? []} blockedByCount={task.blockedByCount ?? 0} focused={focusedTaskId === task.id} onFocus={() => onFocusTask(task.id)} onOpen={() => onOpenTask(task.id)} onDragStart={event => event.dataTransfer.setData("text/plain", String(task.id))} /></div>)}</div><button onClick={() => onNewTask()} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold text-[#7C929F] hover:bg-white hover:text-[#2778A9]"><Plus className="h-3.5 w-3.5" />Add task</button></section>; })}</div></div>
}
