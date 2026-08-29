import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { formatTime } from "@/pages/home/helpers";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: number;
  type: "assigned" | "commented" | "mentioned" | "due_today" | "overdue" | "automation";
  readAt: Date | null;
  createdAt: Date;
  actorName: string | null;
  taskId: number | null;
  taskTitle: string | null;
  projectName: string | null;
};

function messageFor(row: NotificationRow) {
  const actor = row.actorName || "A teammate";
  const task = row.taskTitle ? `“${row.taskTitle}”` : "a task";
  if (row.type === "assigned") return `${actor} assigned you ${task}.`;
  if (row.type === "commented") return `${actor} commented on ${task}.`;
  if (row.type === "due_today") return `${task} is due today.`;
  if (row.type === "overdue") return `${task} is overdue.`;
  if (row.type === "automation") return `${actor} automation updated ${task}.`;
  return `${actor} mentioned you in ${task}.`;
}

/** Header bell with unread badge; opens a popover list and deep-links to the task on click. */
export function NotificationBell({ onSelectTask }: { onSelectTask: (taskId: number) => void }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const list = trpc.tasknest.notification.list.useQuery(undefined, { enabled: open || true, refetchInterval: 30_000 });
  const markRead = trpc.tasknest.notification.markRead.useMutation({
    onSuccess: () => utils.tasknest.notification.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const markAllRead = trpc.tasknest.notification.markAllRead.useMutation({
    onSuccess: () => utils.tasknest.notification.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const unreadCount = list.data?.unreadCount ?? 0;
  const rows = list.data?.notifications ?? [];

  const openNotification = (row: NotificationRow) => {
    if (!row.readAt) markRead.mutate({ notificationId: row.id });
    setOpen(false);
    if (row.taskId) onSelectTask(row.taskId);
  };

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="icon" className="relative h-8 w-8 rounded-lg" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
        <Bell className="h-3.5 w-3.5" />
        {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF6B5E] px-1 text-[8px] font-extrabold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 p-0">
      <div className="flex items-center justify-between border-b border-[#E5EDF2] px-4 py-3">
        <p className="text-sm font-extrabold text-[#27445D]">Notifications</p>
        {unreadCount > 0 && <Button type="button" variant="ghost" size="sm" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()} className="h-7 text-[10px] font-extrabold text-[#247EAF]"><CheckCheck className="mr-1 h-3 w-3" />Mark all read</Button>}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {list.isLoading && <p className="p-4 text-center text-xs text-[#718A9A]">Loading notifications…</p>}
        {!list.isLoading && rows.length === 0 && <div className="p-6 text-center"><Bell className="mx-auto h-5 w-5 text-[#9BAAB3]" /><p className="mt-2 text-xs text-[#718A9A]">You're all caught up. Assignments and comments will appear here.</p></div>}
        {rows.map((row: NotificationRow) => <button key={row.id} type="button" onClick={() => openNotification(row)} className={cn("flex w-full items-start gap-2.5 border-b border-[#EEF3F5] px-4 py-3 text-left last:border-0 hover:bg-[#F8FBFC]", !row.readAt && "bg-[#F3FAFF]")}>
          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !row.readAt ? "bg-[#FF6B5E]" : "bg-transparent")} />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold leading-4 text-[#395269]">{messageFor(row)}</span>
            <span className="mt-0.5 block text-[9px] font-bold text-[#9BAAB3]">{row.projectName ? `${row.projectName} · ` : ""}{formatTime(row.createdAt)}</span>
          </span>
        </button>)}
      </div>
    </PopoverContent>
  </Popover>;
}
