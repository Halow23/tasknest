import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ProjectField = {
  id: number;
  name: string;
  type: "text" | "select" | "date";
  options: string[] | null;
};

export type CustomFieldValue = { fieldId: number; value: string };

export function toFieldValuesRecord(fields: ProjectField[], values: { fieldId: number; value: string | null }[] | undefined) {
  const record: Record<number, string> = {};
  (values ?? []).forEach(entry => {
    if (entry.value) record[entry.fieldId] = entry.value;
  });
  return record;
}

export function toFieldValuesInput(record: Record<number, string>): CustomFieldValue[] {
  return Object.entries(record).map(([fieldId, value]) => ({ fieldId: Number(fieldId), value }));
}

function formatDisplayDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function DateFieldPicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return <div className="flex gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={cn("h-10 flex-1 min-w-0 justify-start px-3 text-left font-normal", !value && "text-muted-foreground")} aria-label={label}>
          <CalendarIcon className="mr-1 h-4 w-4 text-[#4B92BB]" />
          {value ? formatDisplayDate(value) : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} defaultMonth={selected ?? new Date()} onSelect={(date) => { onChange(date ? calendarKey(date) : ""); setOpen(false); }} />
      </PopoverContent>
    </Popover>
    {value && <Button type="button" variant="outline" size="icon" aria-label={`Clear ${label}`} onClick={() => onChange("")} className="h-10 w-10 shrink-0"><X className="h-4 w-4" /></Button>}
  </div>;
}

const CLEAR_VALUE = "__clear__";

function calendarKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function TaskCustomFields({ fields, values, onChange }: { fields: ProjectField[]; values: Record<number, string>; onChange: (next: Record<number, string>) => void }) {  if (!fields.length) return null;
  const setValue = (fieldId: number, value: string) => onChange({ ...values, [fieldId]: value });
  return <div className="space-y-4">
    {fields.map(field => <div key={field.id} data-field-id={field.id}>
      <Label htmlFor={`custom-field-${field.id}`}>{field.name}</Label>
      {field.type === "text" && <Input id={`custom-field-${field.id}`} value={values[field.id] ?? ""} onChange={event => setValue(field.id, event.target.value)} className="mt-1" placeholder={`Enter ${field.name.toLowerCase()}…`} />}
      {field.type === "select" && <div className="mt-1">
        <Select value={values[field.id] ?? ""} onValueChange={value => setValue(field.id, value === CLEAR_VALUE ? "" : value)}>
          <SelectTrigger id={`custom-field-${field.id}`} className="h-10 w-full">
            <SelectValue placeholder={`Choose ${field.name.toLowerCase()}…`} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            <SelectItem value={CLEAR_VALUE}><X className="mr-1 h-3.5 w-3.5" />Clear</SelectItem>
          </SelectContent>
        </Select>
      </div>}
      {field.type === "date" && <div className="mt-1"><DateFieldPicker id={`custom-field-${field.id}`} label={field.name} value={values[field.id] ?? ""} onChange={value => setValue(field.id, value)} /></div>}
    </div>)}
  </div>;
}
