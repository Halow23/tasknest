import { useEffect, useRef, useState } from "react";
import { MessageSquare, Plus, Send, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDate } from "./helpers";
import type { Member } from "./types";

type ChatMessage = { id: string; groupId: string; authorId: string; authorName: string; body: string; createdAt: Date };

type ChatGroup = {
  id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  updatedAt: Date;
  unread: number;
  lastMessage: { body: string; authorId: string; createdAt: Date } | null;
  messages: ChatMessage[];
};

function initials(value: string | null | undefined) {
  const words = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map(word => word[0]!.toUpperCase()).join("");
}

/** Workspace group messaging: conversation list + message thread. */
export function ChatView({ workspaceId, members, currentUserId }: { workspaceId: string; members: Member[]; currentUserId: string | null }) {
  const utils = trpc.useUtils();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const groupsQuery = trpc.tasknest.chat.groupsList.useQuery();
  const groups = (groupsQuery.data ?? []) as ChatGroup[];
  const selectedGroup = groups.find(group => group.id === selectedGroupId) ?? null;
  const visibleMessages = [...(selectedGroup?.messages ?? []), ...pending.filter(message => message.groupId === selectedGroupId)];

  const invalidate = () => { void utils.tasknest.chat.groupsList.invalidate(); };

  const markRead = trpc.tasknest.chat.groupsMarkRead.useMutation({ onSettled: () => invalidate() });
  const createGroup = trpc.tasknest.chat.groupsCreate.useMutation({
    onSuccess: group => { setCreateOpen(false); setCreateName(""); setSelectedGroupId(group.id); invalidate(); toast.success("Group created."); },
    onError: error => toast.error(error.message),
  });
  const addMember = trpc.tasknest.chat.groupsAddMember.useMutation({ onSuccess: () => { invalidate(); toast.success("Member added."); }, onError: error => toast.error(error.message) });
  const removeMember = trpc.tasknest.chat.groupsRemoveMember.useMutation({ onSuccess: () => { invalidate(); toast.success("Member removed."); }, onError: error => toast.error(error.message) });

  const sendMessage = trpc.tasknest.chat.messagesSend.useMutation({
    onMutate: variables => {
      setPending(current => [...current, { id: `pending-${Date.now()}`, groupId: variables.groupId, authorId: currentUserId ?? "me", authorName: "You", body: variables.body, createdAt: new Date() }]);
      setDraft("");
    },
    onError: error => {
      setPending(current => current.slice(0, -1));
      toast.error(error.message);
    },
    onSettled: () => {
      setPending(current => current.slice(1));
      invalidate();
    },
  });

  useEffect(() => {
    if (selectedGroupId) markRead.mutate({ groupId: selectedGroupId });
  }, [selectedGroupId, workspaceId, visibleMessages.length]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [visibleMessages.length, selectedGroupId]);

  const selectedMembers = members.filter(member => selectedGroup?.memberIds.includes(member.id));
  const addableMembers = members.filter(member => !selectedGroup?.memberIds.includes(member.id));
  const isCreator = selectedGroup?.createdBy === currentUserId;

  const submit = () => {
    if (!draft.trim() || !selectedGroupId) return;
    sendMessage.mutate({ groupId: selectedGroupId, body: draft.trim() });
  };

  return <main className="flex min-h-0 flex-1 flex-col bg-[#FBFCFD]">
    {groupsQuery.isLoading ? <div className="flex flex-1 items-center justify-center text-sm font-bold text-[#79909E]">Loading conversations…</div> : <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside aria-label="Chat groups" className="flex max-h-56 shrink-0 flex-col overflow-hidden border-b border-[#E2EBF0] bg-white md:max-h-none md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-3"><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#9BAAB3]">Groups</p><Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} aria-label="Create group" className="h-7 px-2 text-[10px] text-[#2B789F]"><Plus className="mr-1 h-3 w-3" />New</Button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{groups.length === 0 ? <p className="px-2 py-3 text-xs text-[#8A9BA6]">No groups yet. Create one to start talking.</p> : groups.map(group => <button key={group.id} onClick={() => setSelectedGroupId(group.id)} aria-current={selectedGroupId === group.id || undefined} className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left", selectedGroupId === group.id ? "bg-[#EAF6FF]" : "hover:bg-[#F4F8FA]")}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF6FB] text-[#31779F]"><MessageSquare className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-extrabold text-[#31546B]">{group.name}</span><span className="block truncate text-[10px] text-[#8A9BA6]">{group.lastMessage ? group.lastMessage.body : "No messages yet"}</span></span>
          {group.unread > 0 && <Badge className="h-5 shrink-0 border-0 bg-[#FF6B5E] px-1.5 text-[10px] font-extrabold text-white">{group.unread > 9 ? "9+" : group.unread}</Badge>}
        </button>)}</div>
      </aside>
      <section className="flex min-h-0 flex-1 flex-col bg-white" aria-label="Message thread">
        {!selectedGroup ? <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center"><MessageSquare className="h-8 w-8 text-[#B7C5CE]" /><p className="text-sm font-bold text-[#5F7E91]">Select a group to read its conversation.</p></div> : <>
          <header className="flex items-center justify-between gap-3 border-b border-[#E2EBF0] px-4 py-3">
            <div className="min-w-0"><p className="truncate text-sm font-extrabold text-[#172B4D]">{selectedGroup.name}</p><p className="text-[10px] font-bold text-[#8A9BA6]">{selectedGroup.memberIds.length} member{selectedGroup.memberIds.length === 1 ? "" : "s"}</p></div>
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} aria-label="Manage group members" className="h-8 text-[10px] text-[#2B789F]"><UsersRound className="mr-1 h-3.5 w-3.5" />Members</Button>
          </header>
          <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
            {visibleMessages.length === 0 ? <p className="text-center text-xs text-[#8A9BA6]">No messages yet — say hello.</p> : visibleMessages.map((message, index) => {
              const mine = message.authorId === currentUserId;
              const previous = visibleMessages[index - 1];
              const grouped = previous && previous.authorId === message.authorId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60 * 1000;
              const pendingMessage = message.id.startsWith("pending-");
              return <div key={message.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
                {!mine && !grouped && <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="bg-[#EAF6FF] text-[9px] font-extrabold text-[#2474A3]">{initials(message.authorName)}</AvatarFallback></Avatar>}
                <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2", mine ? "bg-[#38A9F2] text-white" : "bg-[#F1F5F7] text-[#172B4D]", pendingMessage && "opacity-60")}>
                  {!mine && !grouped && <p className="mb-0.5 text-[10px] font-extrabold text-[#31779F]">{message.authorName}</p>}
                  <p className="whitespace-pre-wrap break-words text-[13px] leading-5">{message.body}</p>
                  <p className={cn("mt-0.5 text-right text-[9px] font-semibold", mine ? "text-white/75" : "text-[#9BAAB3]")}>{pendingMessage ? "Sending…" : formatDate(message.createdAt)}</p>
                </div>
              </div>;
            })}
          </div>
          <form onSubmit={event => { event.preventDefault(); submit(); }} className="flex items-end gap-2 border-t border-[#E2EBF0] px-4 py-3">
            <Input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message" maxLength={2000} className="bg-white text-sm" />
            <Button type="submit" disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message" className="shrink-0 bg-[#FF6B5E] hover:bg-[#E95A4F]"><Send className="h-4 w-4" /></Button>
          </form>
        </>}
      </section>
    </div>}
    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Create a chat group</DialogTitle><DialogDescription>Groups are private to the teammates you add.</DialogDescription></DialogHeader><div><Label htmlFor="chat-group-name" className="text-xs font-bold text-[#3A5970]">Group name</Label><Input id="chat-group-name" value={createName} onChange={event => setCreateName(event.target.value)} maxLength={60} className="mt-2 bg-white text-sm" /></div><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button disabled={!createName.trim() || createGroup.isPending} onClick={() => createGroup.mutate({ name: createName.trim() })} className="bg-[#FF6B5E] hover:bg-[#E95A4F]">{createGroup.isPending ? "Creating…" : "Create group"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={manageOpen} onOpenChange={setManageOpen}><DialogContent><DialogHeader><DialogTitle>Members of {selectedGroup?.name}</DialogTitle><DialogDescription>{isCreator ? "Add teammates or remove them from this group." : "Only the group creator can manage members."}</DialogDescription></DialogHeader><div className="space-y-2">{selectedMembers.map(member => <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#E5EDF2] px-3 py-2"><div className="flex min-w-0 items-center gap-2.5"><Avatar className="h-7 w-7"><AvatarFallback className="bg-[#EAF6FF] text-[9px] font-extrabold text-[#2474A3]">{initials(member.name ?? member.email)}</AvatarFallback></Avatar><span className="min-w-0 truncate text-xs font-bold text-[#31546B]">{member.name ?? member.email}{member.id === currentUserId ? " (you)" : ""}</span></div>{isCreator && member.id !== selectedGroup?.createdBy && <Button variant="ghost" size="sm" aria-label={`Remove ${member.name ?? "member"}`} onClick={() => selectedGroupId && removeMember.mutate({ groupId: selectedGroupId, userId: member.id })} className="h-7 text-[10px] text-[#C9554B] hover:bg-[#FFF0EE]"><X className="mr-1 h-3 w-3" />Remove</Button>}</div>)}</div>{isCreator && addableMembers.length > 0 && <div className="mt-4"><Label className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8498A5]">Workspace members to add</Label><div className="mt-2 flex flex-wrap gap-1.5">{addableMembers.map(member => <Button key={member.id} variant="outline" size="sm" onClick={() => selectedGroupId && addMember.mutate({ groupId: selectedGroupId, userId: member.id })} className="h-7 text-[10px] text-[#2B789F]"><Plus className="mr-1 h-3 w-3" />{member.name ?? member.email}</Button>)}</div></div>}</DialogContent></Dialog>
  </main>;
}
