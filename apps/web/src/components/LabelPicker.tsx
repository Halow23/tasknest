import { useMemo, useState } from "react";
import { Plus, Tags, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export type WorkspaceLabel = { id: string; name: string; color: string };

export function LabelChip({ label, onRemove }: { label: WorkspaceLabel; onRemove?: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold" style={{ backgroundColor: `${label.color}1A`, color: label.color }}>
    {label.name}
    {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove label ${label.name}`} className="hover:opacity-70"><X className="h-2.5 w-2.5" /></button>}
  </span>;
}

/** Multi-select label picker with inline creation. Used in task create/edit dialogs. */
export function LabelPicker({ workspaceId, selectedIds, onChange }: { workspaceId: string; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const labelsQuery = trpc.tasknest.label.list.useQuery({ workspaceId }, { enabled: open && Boolean(workspaceId) });
  const labels = (labelsQuery.data ?? []) as WorkspaceLabel[];
  const selected = useMemo(() => labels.filter(label => selectedIds.includes(label.id)), [labels, selectedIds]);
  const invalidate = () => utils.tasknest.label.list.invalidate({ workspaceId });
  const createLabel = trpc.tasknest.label.create.useMutation({
    onSuccess: async created => { setNewName(""); await invalidate(); onChange([...selectedIds, created.labelId]); toast.success(`Label “${created.name}” created.`); },
    onError: error => toast.error(error.message),
  });
  const toggle = (labelId: string) => onChange(selectedIds.includes(labelId) ? selectedIds.filter(id => id !== labelId) : [...selectedIds, labelId]);
  const submit = () => {
    const name = newName.trim();
    if (!name) { toast.error("Give the label a name."); return; }
    createLabel.mutate({ workspaceId, name });
  };

  return <div>
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map(label => <LabelChip key={label.id} label={label} onRemove={() => toggle(label.id)} />)}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-[10px] font-extrabold text-[#247EAF] hover:bg-[#EAF6FF]" aria-label="Add labels">
            <Tags className="mr-1 h-3 w-3" />Labels
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#90A1AB]">Workspace labels</p>
          <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
            {labelsQuery.isLoading && <p className="text-[11px] text-[#718A9A]">Loading labels…</p>}
            {labels.length === 0 && !labelsQuery.isLoading && <p className="text-[11px] text-[#718A9A]">No labels yet — create the first one below.</p>}
            {labels.map(label => {
              const active = selectedIds.includes(label.id);
              return <button key={label.id} type="button" onClick={() => toggle(label.id)} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11px] font-bold hover:bg-[#F4F8FA]", active && "bg-[#EAF6FF]")} aria-pressed={active}>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />{label.name}</span>
                {active && <span className="text-[9px] font-extrabold text-[#247EAF]">ON</span>}
              </button>;
            })}
          </div>
          <div className="mt-3 border-t border-[#E5EDF2] pt-3">
            <Label htmlFor="new-label-name" className="text-[10px]">New label</Label>
            <div className="mt-1 flex gap-1.5">
              <Input id="new-label-name" value={newName} onChange={event => setNewName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} placeholder="e.g. Marketing" className="h-8 text-[11px]" />
              <Button type="button" size="icon" disabled={createLabel.isPending || !newName.trim()} onClick={submit} className="h-8 w-8 shrink-0 bg-[#38A9F2] hover:bg-[#248FCC]" aria-label="Create label"><Plus className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  </div>;
}
