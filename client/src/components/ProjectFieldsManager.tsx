import { useState } from "react";
import { Plus, Shapes, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type FieldType = "text" | "select" | "date";

const fieldTypeLabels: Record<FieldType, string> = { text: "Text", select: "Dropdown", date: "Date" };

/**
 * Per-project custom field management, rendered inside the project Edit dialog.
 * Field definitions apply to every task in the project.
 */
export function ProjectFieldsManager({ projectId }: { projectId: number }) {
  const utils = trpc.useUtils();
  const fieldsQuery = trpc.tasknest.field.list.useQuery({ projectId }, { enabled: projectId > 0 });
  const fields = (fieldsQuery.data ?? []).map(field => ({ ...field, options: Array.isArray(field.options) ? (field.options as string[]) : null }));
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");
  const invalidate = () => utils.tasknest.field.list.invalidate({ projectId });
  const createField = trpc.tasknest.field.create.useMutation({
    onSuccess: async () => { setNewFieldName(""); setNewFieldOptions(""); await invalidate(); toast.success("Custom field added to this project."); },
    onError: error => toast.error(error.message),
  });
  const deleteField = trpc.tasknest.field.delete.useMutation({
    onSuccess: async () => { await invalidate(); toast.success("Custom field removed."); },
    onError: error => toast.error(error.message),
  });

  const submit = () => {
    const name = newFieldName.trim();
    if (!name) { toast.error("Give the custom field a name."); return; }
    const options = newFieldType === "select" ? newFieldOptions.split(",").map(option => option.trim()).filter(Boolean) : undefined;
    if (newFieldType === "select" && (!options || options.length === 0)) { toast.error("List at least one dropdown option, separated by commas."); return; }
    createField.mutate({ projectId, name, type: newFieldType, options });
  };

  return <section className="rounded-xl border border-[#DCE8EE] bg-[#F8FBFC] p-4" aria-label="Project custom fields">
    <div className="flex items-center justify-between">
      <div><h3 className="text-sm font-extrabold text-[#27445D]">Custom fields</h3><p className="mt-0.5 text-[11px] text-[#718A9A]">Extra structured details every task in this project can carry.</p></div>
      <Badge variant="outline" className="border-0 bg-[#EAF6FF] text-[10px] font-bold text-[#2776A5]">{fieldsQuery.data?.length ?? 0} field{(fieldsQuery.data?.length ?? 0) === 1 ? "" : "s"}</Badge>
    </div>
    <div className="mt-3 space-y-2">
      {fieldsQuery.isLoading && <p className="text-[11px] text-[#718A9A]">Loading fields…</p>}
      {fields.length === 0 && !fieldsQuery.isLoading && <p className="rounded-lg border border-dashed border-[#D7E5EB] bg-white p-3 text-center text-[11px] text-[#718A9A]">No custom fields yet. Add one to capture details that matter to this project.</p>}
      {fields.map(field => <div key={field.id} className="flex items-center gap-3 rounded-lg border border-[#E2EBF0] bg-white p-3">
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#294A62]">{field.name}</p>{field.type === "select" && field.options?.length ? <p className="mt-0.5 truncate text-[10px] text-[#78909F]">{field.options.join(" · ")}</p> : null}</div>
        <Badge variant="outline" className="h-5 border-0 bg-[#EEF6FB] px-1.5 text-[10px] font-bold capitalize text-[#31779F]">{fieldTypeLabels[field.type] ?? field.type}</Badge>
        <Button type="button" size="icon" variant="ghost" disabled={deleteField.isPending} onClick={() => deleteField.mutate({ fieldId: field.id })} aria-label={`Delete custom field ${field.name}`}><Trash2 className="h-3.5 w-3.5 text-[#D44A3F]" /></Button>
      </div>)}
    </div>
    <div className="mt-4 space-y-2 rounded-lg border border-[#DDEAF0] bg-white p-3">
      <div><Label htmlFor="new-field-name" className="text-xs">Field name</Label><Input id="new-field-name" value={newFieldName} onChange={event => setNewFieldName(event.target.value)} placeholder="e.g. Department" className="mt-1 h-9 text-sm" /></div>
      <div><Label htmlFor="new-field-type" className="text-xs">Field type</Label>
        <Select value={newFieldType} onValueChange={value => setNewFieldType(value as FieldType)}>
          <SelectTrigger id="new-field-type" className="mt-1 h-9 w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="text"><span className="capitalize">Text</span></SelectItem>
            <SelectItem value="select">Dropdown</SelectItem>
            <SelectItem value="date">Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {newFieldType === "select" && <div><Label htmlFor="new-field-options" className="text-xs">Dropdown options</Label><Input id="new-field-options" value={newFieldOptions} onChange={event => setNewFieldOptions(event.target.value)} placeholder="Design, Development, QA" className="mt-1 h-9 text-sm" /><p className="mt-1 text-[10px] text-[#78909F]">Separate options with commas. Existing task answers are not migrated if options change.</p></div>}
      <Button type="button" size="sm" disabled={createField.isPending || !newFieldName.trim()} onClick={submit} className="h-8 w-full bg-[#38A9F2] text-[11px] hover:bg-[#248FCC]"><Plus className="mr-1 h-3.5 w-3.5" />{createField.isPending ? "Adding…" : "Add field"}</Button>
    </div>
    <p className="mt-3 flex items-center gap-1 text-[10px] text-[#8B9EAA]"><Shapes className="h-3 w-3" />Deleting a field also removes its stored answers from every task in this project.</p>
  </section>;
}
