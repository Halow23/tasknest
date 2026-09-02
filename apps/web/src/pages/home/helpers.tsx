import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Member } from "./types";

export function initials(value: string | null | undefined) {
  return (value || "Teammate").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

export function formatDate(date: Date | null) {
  if (!date) return "No deadline";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return "Today";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function buildMonthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingDays = first.getDay();
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => index < leadingDays ? null : new Date(month.getFullYear(), month.getMonth(), index - leadingDays + 1));
}

export function formatTime(date: Date) {
  const elapsed = Date.now() - new Date(date).getTime();
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

export function avatarTone(index: number) {
  return ["bg-[#E8F0F4] text-[#385870]", "bg-[#BDE6FF] text-[#1A5C82]", "bg-[#D9EAD8] text-[#426046]", "bg-[#F9DDB1] text-[#7D5214]"][index % 4];
}

export function Faces({ members, compact = false }: { members: Member[]; compact?: boolean }) {
  if (!members.length) return <span className="text-[10px] font-bold text-[#91A3AE]">Unassigned</span>;
  return <div className="flex -space-x-2">{members.slice(0, 4).map((member, index) => <Avatar key={member.id} className={cn("border-2 border-white", compact ? "h-5 w-5" : "h-7 w-7")}><AvatarFallback className={cn("text-[8px] font-extrabold", avatarTone(index))}>{initials(member.name || member.email)}</AvatarFallback></Avatar>)}</div>;
}

export function DueDatePicker({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T00:00:00`) : undefined;
  return <div className="flex gap-2">
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" id={id} variant="outline" className={cn("h-9 flex-1 min-w-0 justify-start px-3 text-left font-normal", !value && "text-muted-foreground")} aria-label="Due date">
          <CalendarIcon className="mr-1 h-4 w-4 text-[#4B92BB]" />
          {value ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(selected!) : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={selected} defaultMonth={selected ?? new Date()} onSelect={date => { onChange(date ? calendarDateKey(date) : ""); setOpen(false); }} />
      </PopoverContent>
    </Popover>
    {value && <Button type="button" variant="outline" size="icon" aria-label="Clear due date" onClick={() => onChange("")} className="h-9 w-9 shrink-0"><X className="h-4 w-4" /></Button>}
  </div>;
}
