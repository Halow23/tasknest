import { useState } from "react";
import { Bot, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type Trigger = "task_created" | "task_completed" | "comment_added";
type Action = "assign_user" | "set_priority" | "move_status" | "notify_user";

const triggerLabels: Record<Trigger, string> = { task_created: "A task is created", task_completed: "A task is completed", comment_added: "A comment is added" };
const actionLabels: Record<Action, string> = { assign_user: "Assign to member", set_priority: "Set priority", move_status: "Move to lane", notify_user: "Notify member" };

/** Workspace automation rules: when [trigger] then [action]. */
export function AutomationSettingsDialog({ open, onOpenChange, workspaceId, members }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: number;
  members: { id: number; name: string | null; email: string | null }[];
}) {
  const utils = trpc.useUtils();
  const rulesQuery = trpc.tasknest.automation.list.useQuery({ workspaceId }, { enabled: open });
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<Trigger>("task_completed");
  const [action, setAction] = useState<Action>("notify_user");
  const [actionValue, setActionValue] = useState("");
  const invalidate = () => utils.tasknest.automation.list.invalidate({ workspaceId });
  const createRule = trpc.tasknest.automation.create.useMutation({
    onSuccess: async result => { setName(""); setActionValue(""); await invalidate(); toast.success(`Automation “${result.name}” created.`); },
    onError: error => toast.error(error.message),
  });
  const setEnabled = trpc.tasknest.automation.setEnabled.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const deleteRule = trpc.tasknest.automation.delete.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });

  const needsMember = action === "assign_user" || action === "notify_user";
  const submit = () => {
    if (!name.trim()) { toast.error("Name the automation."); return; }
    createRule.mutate({ workspaceId, name: name.trim(), trigger, action, actionValue });
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Workspace automations</DialogTitle>
        <DialogDescription>Rules run automatically when their trigger fires. They never cascade into other rules.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        {rulesQuery.isLoading && <p className="text-[11px] text-[#718A9A]">Loading rules…</p>}
        {(rulesQuery.data ?? []).length === 0 && !rulesQuery.isLoading && <p className="rounded-xl border border-dashed border-[#D7E5EB] bg-[#F8FBFC] p-4 text-center text-[11px] text-[#718A9A]">No automations yet. Create one below to put routine work on autopilot.</p>}
        {(rulesQuery.data ?? []).map(rule => <div key={rule.id} className="flex items-center gap-3 rounded-xl border border-[#E2EBF0] bg-white p-3">
          <Bot className="h-4 w-4 shrink-0 text-[#2680B5]" />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#294A62]">{rule.name}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-[#718A9A]">When {triggerLabels[rule.trigger]} → {actionLabels[rule.action]} · {rule.actionValue}</p></div>
          <button type="button" onClick={() => setEnabled.mutate({ ruleId: rule.id, enabled: !rule.enabled })} className="shrink-0" aria-label={`${rule.enabled ? "Disable" : "Enable"} automation ${rule.name}`}>
            <Badge variant="outline" className={`h-5 cursor-pointer border-0 px-1.5 text-[9px] font-extrabold ${rule.enabled ? "bg-[#E5F5EA] text-[#3E7A52]" : "bg-[#F0F5F7] text-[#8A9BA6]"}`}>{rule.enabled ? "ON" : "OFF"}</Badge>
          </button>
          <Button type="button" size="icon" variant="ghost" onClick={() => deleteRule.mutate({ ruleId: rule.id })} aria-label={`Delete automation ${rule.name}`}><Trash2 className="h-3.5 w-3.5 text-[#D44A3F]" /></Button>
        </div>)}
      </div>
      <section className="space-y-2 rounded-xl border border-[#DCE8EE] bg-[#F8FBFC] p-3" aria-label="Create automation">
        <Label htmlFor="automation-name" className="text-xs">New automation</Label>
        <Input id="automation-name" value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Auto-assign QA on completion" className="h-9 text-sm" />
        <div className="grid grid-cols-2 gap-2">
          <div><Label htmlFor="automation-trigger" className="text-[10px]">When</Label><Select value={trigger} onValueChange={value => setTrigger(value as Trigger)}><SelectTrigger id="automation-trigger" className="mt-1 h-9 w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(triggerLabels) as Trigger[]).map(key => <SelectItem key={key} value={key}>{triggerLabels[key]}</SelectItem>)}</SelectContent></Select></div>
          <div><Label htmlFor="automation-action" className="text-[10px]">Then</Label><Select value={action} onValueChange={value => { setAction(value as Action); setActionValue(""); }}><SelectTrigger id="automation-action" className="mt-1 h-9 w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(actionLabels) as Action[]).map(key => <SelectItem key={key} value={key}>{actionLabels[key]}</SelectItem>)}</SelectContent></Select></div>
        </div>
        {needsMember
          ? <Select value={actionValue} onValueChange={setActionValue}><SelectTrigger className="h-9 w-full" aria-label="Choose member"><SelectValue placeholder="Choose a member…" /></SelectTrigger><SelectContent>{members.map(member => <SelectItem key={member.id} value={String(member.id)}>{member.name || member.email || "Teammate"}</SelectItem>)}</SelectContent></Select>
          : <Select value={actionValue} onValueChange={setActionValue}><SelectTrigger className="h-9 w-full" aria-label="Choose value"><SelectValue placeholder="Choose a value…" /></SelectTrigger><SelectContent>{action === "set_priority" ? <><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></> : <><SelectItem value="backlog">Up next</SelectItem><SelectItem value="progress">In progress</SelectItem><SelectItem value="review">In review</SelectItem><SelectItem value="done">Complete</SelectItem></>}</SelectContent></Select>}
        <Button type="button" size="sm" disabled={createRule.isPending || !name.trim() || !actionValue} onClick={submit} className="h-8 w-full bg-[#38A9F2] text-[11px] hover:bg-[#248FCC]"><Plus className="mr-1 h-3.5 w-3.5" />{createRule.isPending ? "Creating…" : "Create automation"}</Button>
      </section>
    </DialogContent>
  </Dialog>;
}
