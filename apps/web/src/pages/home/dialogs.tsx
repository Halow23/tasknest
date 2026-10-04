import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LabelChip, type WorkspaceLabel } from '@/components/LabelPicker';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { Faces, formatDate } from './helpers';
import { columns, priorityStyle, type Member, type TaskSummary } from './types';
import type { DragEvent } from 'react';

/** Sidebar trash row for a soft-deleted task with restore and delete-forever. */
export function TrashTaskRow({ taskId, workspaceId, title, projectName }: { taskId: string; workspaceId: string; title: string; projectName: string }) {
  const utils = trpc.useUtils();
  const restore = trpc.tasknest.task.restore.useMutation({ onSuccess: () => { utils.tasknest.trash.list.invalidate(); utils.tasknest.task.list.invalidate(); toast.success("Task restored."); }, onError: error => toast.error(error.message) });
  const purge = trpc.tasknest.trash.purgeTask.useMutation({ onSuccess: () => { utils.tasknest.trash.list.invalidate(); toast.success("Task permanently deleted."); }, onError: error => toast.error(error.message) });
  return <div className="flex h-8 items-center gap-2 rounded-xl px-2.5 text-[11px] font-bold text-[#9BAAB3]"><span className="min-w-0 flex-1 truncate" title={`${title} · ${projectName}`}>{title}</span><button onClick={() => restore.mutate({ taskId, workspaceId })} className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-[#4B92BB] hover:bg-[#F4F8FA]" aria-label={`Restore task ${title}`}>Restore</button><button onClick={() => purge.mutate({ taskId, workspaceId })} className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-extrabold text-[#D44A3F] hover:bg-[#FFF0EE]" aria-label={`Delete forever task ${title}`}>Delete</button></div>;
}

export function WorkspaceSetup({ name }: { name: string | null | undefined }) {
  const [workspaceName, setWorkspaceName] = useState(name ? `${name.split(" ")[0]}'s team` : "My team");
  const utils = trpc.useUtils();
  const create = trpc.tasknest.workspace.create.useMutation({ onSuccess: async () => { await utils.tasknest.workspace.current.invalidate(); toast.success("Your team workspace is ready."); }, onError: error => toast.error(error.message) });
  return <main className="min-h-screen bg-[#F7FAFB] p-5 text-[#172B4D]"><div className="mx-auto flex min-h-[calc(100vh-40px)] max-w-4xl items-center"><section className="w-full rounded-[28px] border border-[#D8EAF3] bg-white p-7 shadow-[0_20px_60px_rgba(26,74,98,0.09)] sm:p-12"><img src="/images/tasknest-mark_1fcfb7d8.png" alt="TaskNest" className="h-11 w-11" /><p className="mt-10 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2E85B5]">Private team workspace</p><h1 className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#172B4D]">Make space for meaningful work.</h1><p className="mt-4 max-w-md text-sm font-medium leading-6 text-[#587080]">TaskNest begins without sample work. Create a private team workspace when you are ready.</p><form onSubmit={event => { event.preventDefault(); create.mutate({ name: workspaceName }); }} className="mt-7 max-w-lg rounded-2xl border border-[#DDEAF0] p-4"><Label htmlFor="workspace-name">Workspace name</Label><div className="mt-2 flex gap-2"><Input id="workspace-name" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} /><Button disabled={!workspaceName.trim() || create.isPending} className="bg-[#FF6B5E] hover:bg-[#E85B50]">{create.isPending ? "Creating…" : "Create workspace"}</Button></div></form></section></div></main>;
}

/**
 * Board card. Deliberately minimal — four rows, no chrome:
 *   [priority]                     [assignees]
 *   [labels]
 *   title
 *   due date
 *
 * The whole card is the affordance; there is no per-card menu, no status
 * badge and no "open" link. Blocked/recurrence state is no longer surfaced
 * here (see the redesign note in docs/design/reference).
 *
 * Keyboard nav depends on `data-task-card`, `data-task-id`, `tabIndex` and
 * `onFocus` — see `lib/kanbanNavigation.ts` and Home.tsx's arrow-key handler.
 */
export function TaskCard({ task, members, labels, focused, onFocus, onOpen, onDragStart }: { task: TaskSummary; members: Member[]; labels: WorkspaceLabel[]; focused: boolean; onFocus: () => void; onOpen: () => void; onDragStart: (event: DragEvent<HTMLButtonElement>) => void }) {
  return <button draggable data-task-card="true" data-task-id={task.id} tabIndex={focused ? 0 : -1} onFocus={onFocus} onClick={onOpen} onDragStart={onDragStart} aria-label={`${task.title}, ${columns.find(column => column.id === task.status)?.title}`} className={cn("task-card group w-full cursor-grab rounded-tn-card bg-card p-3 text-left shadow-tn-card ring-[2.5px] ring-transparent transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-sm hover:ring-border active:cursor-grabbing focus-visible:outline-none focus-visible:ring-tn-accent motion-reduce:transition-none", focused && "ring-tn-accent")}><div className="flex min-h-[22px] items-start justify-between gap-3"><span className={cn("rounded-tn-chip px-1.5 py-0.5 text-tn-body-2 font-medium capitalize", priorityStyle[task.priority])}>{task.priority}</span><Faces members={members} compact /></div>{labels.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{labels.map(label => <LabelChip key={label.id} label={label} />)}</div>}<h3 className="mt-2 text-tn-body font-medium leading-5 text-foreground">{task.title}</h3><p className="mt-1 text-tn-body-2 font-medium text-tn-text-secondary">{formatDate(task.dueAt)}</p></button>;
}

export function ConfirmDelete({ open, title, description, value, expected, pending, onChange, onConfirm, onOpenChange }: { open: boolean; title: string; description: string; value: string; expected: string; pending: boolean; onChange: (value: string) => void; onConfirm: () => void; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="space-y-2"><Label htmlFor="delete-confirmation">Type <strong>{expected}</strong> to confirm</Label><Input id="delete-confirmation" autoComplete="off" value={value} onChange={event => onChange(event.target.value)} placeholder={expected} /></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="destructive" disabled={value !== expected || pending} onClick={onConfirm}>{pending ? "Deleting…" : "Delete permanently"}</Button></DialogFooter></DialogContent></Dialog>;
}

/** Styled archive confirmation — mirrors ConfirmDelete, but archiving is reversible so no typed confirmation. */
export function ConfirmArchive({ open, title, description, pending, onConfirm, onOpenChange }: { open: boolean; title: string; description: string; pending: boolean; onConfirm: () => void; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={pending} onClick={onConfirm} className="bg-[#247EAF] text-white hover:bg-[#176A98]">{pending ? "Archiving…" : "Archive project"}</Button></DialogFooter></DialogContent></Dialog>;
}
