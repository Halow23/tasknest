import { useEffect, useState } from 'react';
import { Check, Edit3, Repeat, Link2, Lock, FileText, MessageCircle, Paperclip, Send, Trash2, Upload, UsersRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { LabelChip, LabelPicker, type WorkspaceLabel } from '@/components/LabelPicker';
import { TaskCustomFields, toFieldValuesInput, toFieldValuesRecord, type ProjectField } from '@/components/TaskCustomFields';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { ConfirmDelete } from './dialogs';
import { Faces, avatarTone, DueDatePicker, formatDate, formatTime, initials } from './helpers';
import { columns, priorityStyle, type Member, type Priority } from './types';

/**
 * Renders @Name tokens in brand blue; everything else verbatim.
 */
export function renderMentions(body: string) {
  const parts = body.split(/(@[A-Za-z0-9._-]+)/g);
  return parts.map((part, index) => part.startsWith("@") && part.length > 1
    ? <span key={index} className="font-extrabold text-[#2474A3]">{part}</span>
    : <span key={index}>{part}</span>);
}


export function TaskDrawer({ taskId, members, fields, labels, projectTasks, onClose, onDeleted }: { taskId: number | null; members: Member[]; fields: ProjectField[]; labels: WorkspaceLabel[]; projectTasks: { id: number; title: string; status: string }[]; onClose: () => void; onDeleted: () => void }) {
  const utils = trpc.useUtils();
  const detail = trpc.tasknest.task.detail.useQuery({ taskId: taskId ?? 1 }, { enabled: taskId !== null, refetchInterval: 8_000 });
  const [editOpen, setEditOpen] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false); const [comment, setComment] = useState(""); const [subtask, setSubtask] = useState(""); const [confirm, setConfirm] = useState("");
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [editLabelIds, setEditLabelIds] = useState<number[]>([]); const [editAssigneeId, setEditAssigneeId] = useState("unassigned"); const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly" | "monthly">("none"); const [templateName, setTemplateName] = useState(""); const [priority, setPriority] = useState<Priority>("medium"); const [dueDate, setDueDate] = useState(""); const [fieldValues, setFieldValues] = useState<Record<number, string>>({});
  const invalidate = async () => { await Promise.all([utils.tasknest.task.detail.invalidate({ taskId: taskId ?? 1 }), utils.tasknest.task.list.invalidate(), utils.tasknest.analytics.project.invalidate()]); };
  const commentMutation = trpc.tasknest.comment.create.useMutation({
    onMutate: async input => {
      const detailKey = { taskId: taskId ?? 1 };
      await utils.tasknest.task.detail.cancel(detailKey);
      const previousDetail = utils.tasknest.task.detail.getData(detailKey);
      const optimisticComment = { id: -Date.now(), body: input.body, createdAt: new Date(), authorId: -1, authorName: "You" };
      utils.tasknest.task.detail.setData(detailKey, existing => existing ? { ...existing, comments: [...existing.comments, optimisticComment] } : existing);
      return { previousDetail, detailKey };
    },
    onSuccess: async () => { setComment(""); await invalidate(); toast.success("Comment shared with your team."); },
    onError: (error, _input, context) => { if (context?.previousDetail) utils.tasknest.task.detail.setData(context.detailKey, context.previousDetail); toast.error(error.message); },
  });
  const subtaskMutation = trpc.tasknest.subtask.create.useMutation({ onSuccess: async () => { setSubtask(""); await invalidate(); }, onError: error => toast.error(error.message) });
  const toggleMutation = trpc.tasknest.subtask.toggle.useMutation({
    onMutate: async input => {
      const detailKey = { taskId: taskId ?? 1 };
      await utils.tasknest.task.detail.cancel(detailKey);
      const previousDetail = utils.tasknest.task.detail.getData(detailKey);
      utils.tasknest.task.detail.setData(detailKey, existing => existing ? { ...existing, subtasks: existing.subtasks.map(item => item.id === input.subtaskId ? { ...item, completed: input.completed } : item) } : existing);
      return { previousDetail, detailKey };
    },
    onSuccess: invalidate,
    onError: (error, _input, context) => { if (context?.previousDetail) utils.tasknest.task.detail.setData(context.detailKey, context.previousDetail); toast.error(error.message); },
  });
  const moveMutation = trpc.tasknest.task.move.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const updateMutation = trpc.tasknest.task.update.useMutation({ onSuccess: async () => { setEditOpen(false); await invalidate(); toast.success("Task updated."); }, onError: error => toast.error(error.message) });
  const logTimeMutation = trpc.tasknest.time.log.useMutation({ onSuccess: async () => { setTimeMinutes(""); setTimeNote(""); await invalidate(); toast.success("Time logged."); }, onError: error => toast.error(error.message) });
    const deleteTimeMutation = trpc.tasknest.time.delete.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
    const [timeMinutes, setTimeMinutes] = useState("");
    const [timeNote, setTimeNote] = useState("");
    const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
    const [timerElapsed, setTimerElapsed] = useState(0);
  const restoreMutation = trpc.tasknest.task.restore.useMutation({ onSuccess: async () => { await Promise.all([utils.tasknest.task.list.invalidate(), utils.tasknest.trash.list.invalidate()]); toast.success("Task restored."); }, onError: error => toast.error(error.message) });
  const deleteMutation = trpc.tasknest.task.delete.useMutation({ onSuccess: async (result) => { await utils.tasknest.task.list.invalidate(); await utils.tasknest.analytics.project.invalidate(); utils.tasknest.trash.list.invalidate(); toast.success("Task deleted.", { action: { label: "Undo", onClick: () => restoreMutation.mutate({ taskId: result.deletedTaskId }) } }); onDeleted(); }, onError: error => toast.error(error.message) });
  const dependenciesQuery = trpc.tasknest.dependency.list.useQuery({ taskId: taskId ?? 1 }, { enabled: taskId !== null });
  const [dependencySelect, setDependencySelect] = useState("");
  const addDependency = trpc.tasknest.dependency.create.useMutation({ onSuccess: async () => { setDependencySelect(""); await invalidate(); toast.success("Dependency linked."); }, onError: error => toast.error(error.message) });
  const removeDependency = trpc.tasknest.dependency.delete.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const saveTemplate = trpc.tasknest.template.create.useMutation({
      onSuccess: async (result) => { setTemplateName(""); await utils.tasknest.template.list.invalidate(); toast.success(`Template “${result.name}” saved.`); },
      onError: error => toast.error(error.message),
    });
  const uploadMutation = trpc.tasknest.attachment.upload.useMutation({ onSuccess: async () => { await invalidate(); toast.success("File attached."); }, onError: error => toast.error(error.message) });
  const presignMutation = trpc.tasknest.attachment.presign.useMutation();
  const registerMutation = trpc.tasknest.attachment.register.useMutation({ onSuccess: async () => { await invalidate(); toast.success("File attached."); }, onError: error => toast.error(error.message) });
  const task = detail.data;
  useEffect(() => { if (task) { setTitle(task.title); setDescription(task.description || ""); setPriority(task.priority); setDueDate(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 10) : ""); setFieldValues(toFieldValuesRecord(fields, task.fieldValues)); setEditLabelIds((task.labels ?? []).map(label => label.id)); setEditAssigneeId(task.assignees[0] ? String(task.assignees[0].id) : "unassigned"); setRecurrence(task.recurrenceRule ?? "none"); } }, [task, fields]);
  const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
    useEffect(() => {
      if (timerStartedAt === null) return;
      const interval = setInterval(() => setTimerElapsed(Math.floor((Date.now() - timerStartedAt) / 1000)), 1000);
      return () => clearInterval(interval);
    }, [timerStartedAt]);
    const stopTimer = () => {
      if (timerStartedAt === null) return;
      const minutes = Math.max(1, Math.round((Date.now() - timerStartedAt) / 60000));
      setTimerStartedAt(null); setTimerElapsed(0);
      logTimeMutation.mutate({ taskId: taskId ?? 1, minutes, note: "Timer session" });
    };
          const totalLoggedMinutes = (task?.timeEntries ?? []).reduce((sum, entry) => sum + entry.minutes, 0);
    const formatClock = (totalSeconds: number) => `${Math.floor(totalSeconds / 3600)}h ${String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0")}m ${String(totalSeconds % 60).padStart(2, "0")}s`;
    const upload = async (file: File | undefined) => {
      if (!file || !taskId) return;
      if (file.size > MAX_UPLOAD_BYTES) { toast.error("Choose a file smaller than 50 MB."); return; }
      const contentType = file.type || "application/octet-stream";
      const relayThroughServer = () => {
        const reader = new FileReader();
        reader.onload = () => uploadMutation.mutate({ taskId, fileName: file.name, contentType, dataBase64: String(reader.result) });
        reader.readAsDataURL(file);
      };
      try {
        // Browser-direct flow: presign, PUT the bytes straight to storage, then register.
        // uploadUrl is null when signing is unavailable (the Storage emulator), in which
        // case the server relay is the expected path rather than a failure.
        const presigned = await presignMutation.mutateAsync({ taskId, fileName: file.name, contentType, byteSize: file.size });
        if (!presigned.uploadUrl) { relayThroughServer(); return; }
        const putResponse = await fetch(presigned.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
        if (!putResponse.ok) throw new Error(`Upload failed (${putResponse.status})`);
        await registerMutation.mutateAsync({ taskId, fileName: file.name, contentType, byteSize: file.size, storageKey: presigned.key });
      } catch {
        // Fallback: relay the bytes through the base64 upload path.
        toast.info("Direct upload unavailable — sending through the server instead.");
        relayThroughServer();
      }
    };
  return <><Sheet open={taskId !== null} onOpenChange={open => !open && onClose()}><SheetContent className="w-full overflow-y-auto border-l border-[#DDE8EE] bg-[#FBFCFD] p-0 sm:max-w-[540px]">{detail.isLoading && <p className="p-7 text-sm font-bold text-[#718491]">Loading task context…</p>}{task && <div><div className="border-b border-[#E4ECF1] bg-white px-6 pb-5 pt-6"><div className="mb-4 flex items-center justify-between gap-3 pr-10"><div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-0 bg-[#EAF6FF] text-[10px] font-bold text-[#2776A5]">{task.project.name}</Badge><span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize ring-1 ring-inset", priorityStyle[task.priority])}>{task.priority}</span>{task.recurrenceRule && task.recurrenceRule !== "none" && <Badge variant="outline" className="h-5 gap-1 border-0 bg-[#EEF6FB] px-1.5 text-[10px] font-bold capitalize text-[#31779F]"><Repeat className="h-2.5 w-2.5" />{task.recurrenceRule}</Badge>}</div><span className="font-mono text-[10px] font-bold text-[#91A3AE]">#{task.id}</span></div><SheetHeader className="p-0 text-left"><SheetTitle className="text-[22px] font-extrabold leading-7 tracking-[-0.04em] text-[#172B4D]">{task.title}</SheetTitle><SheetDescription className="sr-only">Task details and team collaboration.</SheetDescription></SheetHeader><div className="mt-5 flex flex-wrap items-center justify-between gap-2"><Faces members={task.assignees} /><div className="flex gap-2"><Button variant="outline" size="icon" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/?task=${task.id}`).then(() => toast.success("Task link copied to clipboard.")).catch(() => toast.error("Copy failed — copy the URL manually.")); }} className="h-8 w-8 rounded-lg text-[#2778A9] hover:bg-[#EAF6FF]" aria-label="Copy task link"><Link2 className="h-3.5 w-3.5" /></Button><Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="h-8 rounded-lg text-[10px]"><Edit3 className="mr-1 h-3.5 w-3.5" />Edit</Button><Button variant="outline" size="sm" onClick={() => moveMutation.mutate({ taskId: task.id, status: task.status === "done" ? "progress" : "done" })} className="h-8 rounded-lg text-[10px]"><Check className="mr-1 h-3.5 w-3.5" />{task.status === "done" ? "Reopen" : "Complete"}</Button><Button variant="outline" size="icon" onClick={() => setDeleteOpen(true)} className="h-8 w-8 rounded-lg text-[#D44A3F] hover:bg-[#FFF0EE]"><Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete task</span></Button></div></div></div><div className="space-y-6 px-6 py-6"><section><p className="section-label">Task brief</p><p className="mt-2 text-[12px] font-medium leading-5 text-[#526B7B]">{task.description || "No task brief has been added yet."}</p></section>{(task.labels ?? []).length > 0 && <section className="flex flex-wrap gap-1.5">{(task.labels ?? []).map(label => <LabelChip key={label.id} label={label} />)}</section>}<section className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-[#E2EBF0] bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Due</p><p className="mt-1 text-[12px] font-extrabold text-[#2B526B]">{formatDate(task.dueAt)}</p></div><div className="rounded-xl border border-[#E2EBF0] bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Status</p><p className="mt-1 text-[12px] font-extrabold text-[#2B526B]">{columns.find(column => column.id === task.status)?.title}</p></div></section>{task.fieldValues?.length > 0 && <section aria-label="Custom field values">{task.fieldValues.map(item => <div key={item.fieldId} className="rounded-xl border border-[#E2EBF0] bg-white p-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">{item.name}</p><p className="mt-1 truncate text-[12px] font-extrabold text-[#2B526B]">{item.type === "date" && item.value ? formatDate(new Date(`${item.value}T00:00:00`)) : item.value}</p></div>)}</section>}<section aria-label="Blocked by">
<div className="flex items-center justify-between"><p className="section-label">Blocked by</p><span className="text-[10px] font-bold text-[#78909F]">{(task.openDependencies ?? []).length} open</span></div>
<div className="mt-2 space-y-1.5">{(task.openDependencies ?? []).length === 0 && <p className="rounded-xl border border-dashed border-[#D7E5EB] bg-white p-3 text-[11px] text-[#8B9EAA]">No prerequisites. Link one if this work depends on another task finishing first.</p>}
{(task.openDependencies ?? []).map(dependency => <div key={dependency.dependencyId} className="flex items-center gap-2 rounded-xl border border-[#E2EBF0] bg-white p-3"><Lock className="h-3.5 w-3.5 shrink-0 text-[#A36A00]" /><span className="min-w-0 flex-1 truncate text-[11px] font-extrabold text-[#395269]">{dependency.title}</span><button type="button" disabled={removeDependency.isPending} onClick={() => removeDependency.mutate({ dependencyId: dependency.dependencyId })} className="shrink-0 rounded-md p-1 text-[#7B8F9C] hover:bg-[#FFF0EE] hover:text-[#D44A3F]" aria-label={`Remove dependency ${dependency.title}`}><X className="h-3 w-3" /></button></div>)}
</div>
<div className="mt-2 flex items-center gap-2">
<Select value={dependencySelect} onValueChange={setDependencySelect}><SelectTrigger className="h-8 min-w-0 flex-1 rounded-md bg-background px-2 text-[11px]" aria-label="Choose a prerequisite task"><SelectValue placeholder="Link a prerequisite task…" /></SelectTrigger><SelectContent>{projectTasks.filter(candidate => candidate.id !== task.id && !(task.openDependencies ?? []).some(dependency => dependency.id === candidate.id) && candidate.status !== "done").map(candidate => <SelectItem key={candidate.id} value={String(candidate.id)}>{candidate.title}</SelectItem>)}</SelectContent></Select>
<Button size="sm" disabled={!dependencySelect || addDependency.isPending} onClick={() => addDependency.mutate({ taskId: task.id, dependsOnTaskId: Number(dependencySelect) })} className="h-8 shrink-0 bg-[#38A9F2] text-[10px] hover:bg-[#248FCC]">Link</Button>
</div>
</section>
<section><div className="flex items-center justify-between"><p className="section-label">Subtasks</p><span className="text-[10px] font-bold text-[#78909F]">{task.subtasks.filter(item => item.completed).length}/{task.subtasks.length} done</span></div><div className="mt-2 overflow-hidden rounded-xl border border-[#E2EBF0] bg-white">{task.subtasks.length === 0 && <p className="p-3 text-[11px] text-[#8B9EAA]">Break this work into a few clear next moves.</p>}{task.subtasks.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-2.5 border-b border-[#EEF3F5] px-3 py-3 last:border-0"><Checkbox checked={item.completed} onCheckedChange={checked => toggleMutation.mutate({ subtaskId: item.id, completed: checked === true })} /><span className={cn("text-[11px] font-semibold", item.completed ? "text-[#8C9EA9] line-through" : "text-[#395269]")}>{item.title}</span></label>)}</div><div className="mt-2 flex gap-2"><Input value={subtask} onChange={event => setSubtask(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && subtask.trim()) subtaskMutation.mutate({ taskId: task.id, title: subtask }); }} placeholder="Add a next move…" className="h-8 text-[11px]" /><Button size="sm" disabled={!subtask.trim() || subtaskMutation.isPending} onClick={() => subtaskMutation.mutate({ taskId: task.id, title: subtask })} className="h-8 bg-[#38A9F2] text-[10px] hover:bg-[#248FCC]">Add</Button></div></section><section aria-label="Time tracking">
<div className="flex items-center justify-between"><p className="section-label">Time</p><span className="text-[10px] font-bold text-[#78909F]">{totalLoggedMinutes} min logged</span></div>
<div className="mt-2 flex items-center gap-2">
{timerStartedAt === null ? <Button type="button" size="sm" variant="outline" onClick={() => setTimerStartedAt(Date.now())} className="h-8 text-[10px] font-extrabold text-[#247EAF] hover:bg-[#EAF6FF]" aria-label="Start timer">Start timer</Button> : <Button type="button" size="sm" onClick={stopTimer} className="h-8 bg-[#FF6B5E] text-[10px] font-extrabold hover:bg-[#E95A4F]" aria-label="Stop timer and log">Stop {formatClock(timerElapsed)}</Button>}
</div>
<div className="mt-2 flex gap-2">
<Input value={timeMinutes} onChange={event => setTimeMinutes(event.target.value.replace(/[^0-9]/g, ""))} placeholder="Minutes" className="h-8 w-24 text-[11px]" aria-label="Minutes to log" />
<Input value={timeNote} onChange={event => setTimeNote(event.target.value)} placeholder="What did you work on? (optional)" className="h-8 min-w-0 flex-1 text-[11px]" aria-label="Time log note" />
<Button size="sm" disabled={!timeMinutes || Number(timeMinutes) < 1 || logTimeMutation.isPending} onClick={() => logTimeMutation.mutate({ taskId: task.id, minutes: Number(timeMinutes), note: timeNote.trim() || undefined })} className="h-8 shrink-0 bg-[#38A9F2] text-[10px] hover:bg-[#248FCC]">Log</Button>
</div>
{(task.timeEntries ?? []).length > 0 && <div className="mt-2 space-y-1">{(task.timeEntries ?? []).map(entry => <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-[#E2EBF0] bg-white px-3 py-2"><span className="text-[11px] font-extrabold text-[#27445D]">{entry.minutes} min</span><span className="min-w-0 flex-1 truncate text-[10px] text-[#718A9A]">{entry.note || entry.userName || "Work session"} · {formatTime(entry.loggedAt)}</span><button type="button" onClick={() => deleteTimeMutation.mutate({ entryId: entry.id })} className="shrink-0 rounded-md p-1 text-[#7B8F9C] hover:bg-[#FFF0EE] hover:text-[#D44A3F]" aria-label={`Delete time entry ${entry.id}`}><X className="h-3 w-3" /></button></div>)}</div>}
</section>
<section><div className="flex items-center justify-between"><p className="section-label">Files</p><label className="cursor-pointer text-[10px] font-extrabold text-[#2778A9]"><Upload className="mr-0.5 inline h-3 w-3" />Add file<input type="file" className="sr-only" onChange={event => { void upload(event.target.files?.[0]); }} /></label></div><div className="mt-2 space-y-2">{task.attachments.length === 0 && <p className="rounded-xl border border-dashed border-[#D7E5EB] bg-white p-3 text-[11px] text-[#8B9EAA]">No files attached yet.</p>}{task.attachments.map(item => <a href={item.storageUrl ?? undefined} key={item.id} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-[#E2EBF0] bg-white p-3"><FileText className="h-4 w-4 text-[#2778A9]" /><span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#3A5269]">{item.fileName}</span><span className="text-[9px] text-[#91A3AE]">{Math.max(1, Math.round(item.byteSize / 1024))} KB</span></a>)}</div></section><section><div className="flex items-center justify-between"><div><p className="section-label">Conversation</p><p className="mt-1 text-[10px] font-medium text-[#78909F]">Refreshes automatically while this task is open.</p></div><span className="flex items-center gap-1 text-[10px] font-bold text-[#2778A9]"><MessageCircle className="h-3 w-3" />{task.comments.length}</span></div><div className="mt-3 max-h-65 space-y-3 overflow-y-auto pr-1">{task.comments.length === 0 && <div className="rounded-xl border border-dashed border-[#D7E5EB] bg-white p-4 text-center"><UsersRound className="mx-auto h-4 w-4 text-[#72A2BC]" /><p className="mt-2 text-[11px] font-medium text-[#718A9A]">Start the conversation with useful context for your team.</p></div>}{task.comments.map((item, index) => <article key={item.id} className="flex gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className={cn("text-[8px] font-extrabold", avatarTone(index))}>{initials(item.authorName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-[#EAF6FF] px-3 py-2"><div className="flex items-baseline justify-between gap-2"><strong className="truncate text-[10px] text-[#2E617F]">{item.authorName || "Teammate"}</strong><time className="shrink-0 text-[9px] font-medium text-[#7895A5]">{formatTime(item.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-[11px] font-medium leading-5 text-[#477084]">{renderMentions(item.body)}</p></div></article>)}</div><div className="mt-3 rounded-xl border border-[#DCE8EE] bg-white p-2"><Textarea value={comment} onChange={event => setComment(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && comment.trim()) { event.preventDefault(); commentMutation.mutate({ taskId: task.id, body: comment }); } }} placeholder="Leave a useful note…" className="min-h-18 resize-none border-0 p-1 text-[11px] shadow-none focus-visible:ring-0" /><div className="flex items-center justify-between border-t border-[#EEF3F5] pt-2"><span className="text-[9px] font-medium text-[#90A2AD]">Enter to send · Shift+Enter for a break · @name to mention</span><Button size="sm" disabled={!comment.trim() || commentMutation.isPending} onClick={() => commentMutation.mutate({ taskId: task.id, body: comment })} className="h-7 bg-[#38A9F2] px-2.5 text-[10px] hover:bg-[#248FCC]"><Send className="mr-1 h-3 w-3" />{commentMutation.isPending ? "Sending" : "Send"}</Button></div></div></section></div></div>}</SheetContent></Sheet>{task && <><Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit task</DialogTitle><DialogDescription>Update the work context visible to every project member.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="edit-task-title">Title</Label><Input id="edit-task-title" value={title} onChange={event => setTitle(event.target.value)} className="mt-1" /></div><div><Label htmlFor="edit-task-description">Description</Label><Textarea id="edit-task-description" value={description} onChange={event => setDescription(event.target.value)} className="mt-1" /></div><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="edit-assignee">Assign to</Label><Select value={editAssigneeId} onValueChange={setEditAssigneeId}><SelectTrigger id="edit-assignee" className="mt-1 w-full"><SelectValue placeholder="Unassigned" /></SelectTrigger><SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{members.map(member => <SelectItem key={member.id} value={String(member.id)}>{member.name || member.email || "Teammate"}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="edit-priority">Priority</Label><Select value={priority} onValueChange={value => setPriority(value as Priority)}><SelectTrigger id="edit-priority" className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div><div><Label htmlFor="edit-due">Due date</Label><div className="mt-1"><DueDatePicker id="edit-due" value={dueDate} onChange={setDueDate} /></div></div></div><div className="mt-4"><Label htmlFor="edit-recurrence">Repeats</Label><Select value={recurrence} onValueChange={value => setRecurrence(value as "none" | "daily" | "weekly" | "monthly")}><SelectTrigger id="edit-recurrence" className="mt-1 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Never</SelectItem><SelectItem value="daily">Every day</SelectItem><SelectItem value="weekly">Every week</SelectItem><SelectItem value="monthly">Every month</SelectItem></SelectContent></Select></div><div className="mt-4 border-t border-[#E5EDF2] pt-4"><Label htmlFor="save-template">Save as template</Label><div className="mt-1 flex gap-2"><Input id="save-template" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Reusable name, e.g. Weekly report" className="h-9 text-sm" /><Button type="button" variant="outline" disabled={!templateName.trim() || saveTemplate.isPending} onClick={() => saveTemplate.mutate({ workspaceId: task.project.workspaceId, name: templateName.trim(), title, description: description.trim() || undefined, priority, recurrenceRule: recurrence, subtaskTitles: task.subtasks.map(item => item.title), labelIds: editLabelIds })} className="h-9 shrink-0 text-[11px]">{saveTemplate.isPending ? "Saving…" : "Save"}</Button></div><p className="mt-1 text-[10px] text-[#78909F]">Captures title, description, priority, recurrence, labels, and subtasks for reuse in any project.</p></div><div className="mt-4"><Label htmlFor="edit-labels">Labels</Label><div className="mt-1"><LabelPicker workspaceId={task.project.workspaceId} selectedIds={editLabelIds} onChange={setEditLabelIds} /></div></div>{fields.length > 0 && <div className="border-t border-[#E5EDF2] pt-4"><p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Custom fields</p><TaskCustomFields fields={fields} values={fieldValues} onChange={setFieldValues} /></div>}</div><DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button disabled={!title.trim() || updateMutation.isPending} onClick={() => updateMutation.mutate({ taskId: task.id, title, description: description.trim() || null, priority, dueAt: dueDate ? new Date(`${dueDate}T12:00:00`) : null, fieldValues: toFieldValuesInput(fieldValues), labelIds: editLabelIds, recurrenceRule: recurrence, assigneeIds: editAssigneeId !== "unassigned" ? [Number(editAssigneeId)] : [] })} className="bg-[#38A9F2] hover:bg-[#248FCC]">{updateMutation.isPending ? "Saving…" : "Save changes"}</Button></DialogFooter></DialogContent></Dialog><ConfirmDelete open={deleteOpen} onOpenChange={open => { setDeleteOpen(open); if (!open) setConfirm(""); }} title="Delete this task?" description="This permanently removes the task, its subtasks, comments, attached file records, and activity history." value={confirm} expected={task.title} pending={deleteMutation.isPending} onChange={setConfirm} onConfirm={() => deleteMutation.mutate({ taskId: task.id, confirmation: confirm })} /></>}</>;
}