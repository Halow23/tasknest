import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/pages/home/helpers";

type SearchResult = { id: string; title: string; status: string; priority: string; dueAt: Date | null; projectId: string; projectName?: string; projectColor?: string };

/** ⌘K workspace-wide task search palette. Searches titles, descriptions, and comment bodies. */
export function SearchPalette({ open, onOpenChange, workspaceId, onSelectTask }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onSelectTask: (taskId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => { if (!open) { setQuery(""); setDebounced(""); } }, [open]);
  const search = trpc.tasknest.task.search.useQuery({ workspaceId, query: debounced }, { enabled: open && debounced.length > 0 });

  const handleSelect = (taskId: string) => {
    onOpenChange(false);
    onSelectTask(taskId);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="overflow-hidden p-0" aria-describedby={undefined}>
      <DialogTitle className="sr-only">Search tasks</DialogTitle>
      <DialogDescription className="sr-only">Find tasks across the workspace by title, description, or comment.</DialogDescription>
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search tasks, details, comments…" className="h-12 text-sm" />
        <CommandList>
          {debounced.length === 0 && <div className="p-6 text-center text-xs text-[#718A9A]">Type to search every task in your workspace.</div>}
          {debounced.length > 0 && search.isLoading && <div className="p-6 text-center text-xs text-[#718A9A]">Searching…</div>}
          {debounced.length > 0 && !search.isLoading && (search.data ?? []).length === 0 && <CommandEmpty>No tasks match “{debounced}”.</CommandEmpty>}
          {search.data && search.data.length > 0 && <CommandGroup heading="Tasks">
            {search.data.map((task: SearchResult) => <CommandItem key={task.id} value={String(task.id)} onSelect={() => handleSelect(task.id)} className="cursor-pointer">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{task.title}</span>
              <span className="shrink-0 text-[10px] font-bold text-[#718A9A]">{task.projectName} · {formatDate(task.dueAt)}</span>
            </CommandItem>)}
          </CommandGroup>}
        </CommandList>
      </Command>
    </DialogContent>
  </Dialog>;
}
