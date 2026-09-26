import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowLeftRight, Crown, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/pages/home/dialogs";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDate } from "@/pages/home/helpers";
import { PageLoading, Skeleton, TableSkeleton } from "@/components/Loading";

type MemberRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  joinedAt: Date;
};

function initials(value: string | null | undefined) {
  const words = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return words.slice(0, 2).map(word => word[0]!.toUpperCase()).join("");
}

/** Admin panel: view workspace members, promote/demote, and remove members. */
export default function AdminMembersPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const current = trpc.tasknest.workspace.current.useQuery(undefined, { enabled: isAdmin });
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);
  const [removalConfirmation, setRemovalConfirmation] = useState("");

  const workspace = current.data?.workspace ?? null;
  const members = (current.data?.members ?? []) as MemberRow[];

  const setRole = trpc.members.setRole.useMutation({
    onSuccess: async () => {
      await utils.tasknest.workspace.current.invalidate();
      toast.success("Member role updated.");
    },
    onError: error => toast.error(error.message),
  });
  const removeMember = trpc.members.remove.useMutation({
    onSuccess: async () => {
      await utils.tasknest.workspace.current.invalidate();
      toast.success("Member removed from the workspace.");
    },
    onError: error => toast.error(error.message),
  });

  if (loading) {
    return <PageLoading label="Opening member management" />;
  }

  if (!isAuthenticated) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#D8EAF3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><ShieldCheck className="h-10 w-10 text-[#38A9F2]" /><h1 className="mt-6 font-['DM_Serif_Display'] text-3xl text-[#172B4D]">Sign in to manage members.</h1></section></main>;
  }

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#F2D7D3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><ShieldCheck className="h-10 w-10 text-[#D44A3F]" /><p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#C2574E]">Access restricted</p><h1 className="mt-2 font-['DM_Serif_Display'] text-3xl text-[#172B4D]">Administrator permission required.</h1><Link href="/"><Button className="mt-6 bg-[#38A9F2] hover:bg-[#248FCC]"><ArrowLeft className="mr-1.5 h-4 w-4" />Back to workspace</Button></Link></section></main>;
  }

  const adminCount = members.filter(member => member.role === "admin").length;

  return <main className="min-h-screen bg-[#F7FAFB] text-[#172B4D]"><header className="border-b border-[#DFE9EE] bg-white"><div className="mx-auto flex min-h-18 max-w-5xl items-center justify-between gap-4 px-5 py-3 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Link href="/" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE8EE] text-[#4A7189] transition-colors hover:bg-[#F1F7FA]" aria-label="Back to workspace"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2E85B5]">TaskNest administration</p><h1 className="truncate font-['DM_Serif_Display'] text-[23px] text-[#1F4260]">Members</h1></div></div><Link href="/admin/access" className="shrink-0 text-xs font-extrabold text-[#247EAF] hover:underline">Access settings →</Link></div></header><div className="mx-auto max-w-5xl px-5 py-8 lg:px-8"><section className="grid gap-px overflow-hidden rounded-2xl border border-[#DDE8EE] bg-[#DDE8EE] shadow-[0_12px_35px_rgba(28,77,105,0.05)] sm:grid-cols-2"><div className="bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8197A5]">Members</p><p className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#1E4563]">{members.length}</p><p className="mt-1 text-xs font-medium text-[#718A9A]">People with workspace access</p></div><div className="bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8197A5]">Workspace admins</p><p className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#1E4563]">{adminCount}</p><p className="mt-1 text-xs font-medium text-[#718A9A]">Can manage automations and settings</p></div></section><section className="mt-6 overflow-hidden rounded-2xl border border-[#DDE8EE] bg-white shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><div className="flex items-center gap-3 border-b border-[#E5EDF1] px-5 py-5 sm:px-6"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF6FF] text-[#2779A8]"><UsersRound className="h-5 w-5" /></span><h2 className="text-base font-extrabold text-[#233F59]">Workspace members</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#F7FAFB]"><tr className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8297A5]"><th className="px-5 py-3 sm:px-6">Member</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Joined</th><th className="px-5 py-3 text-right sm:px-6">Actions</th></tr></thead><tbody>{current.isLoading ? <tr><td colSpan={4} className="px-5 py-4"><TableSkeleton rows={4} columns={4} /></td></tr> : members.map(member => { const isOwner = workspace?.ownerId === member.userId; return <tr key={member.userId} className="border-t border-[#EDF2F5] text-xs text-[#456176]"><td className="px-5 py-3.5 sm:px-6"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback className="bg-[#EAF6FF] text-[10px] font-extrabold text-[#2474A3]">{initials(member.name ?? member.email)}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate font-semibold text-[#2E526B]">{member.name ?? "Teammate"}</p><p className="truncate text-[11px] text-[#718A9A]">{member.email ?? "—"}</p></div></div></td><td className="px-4 py-3.5">{isOwner ? <Badge className="border-0 bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-extrabold text-[#A36A00]"><Crown className="mr-1 h-3 w-3" />Owner</Badge> : <Badge variant="outline" className={cn(member.role === "admin" ? "border-[#D8EAF3] bg-[#EAF6FF] text-[#2474A3]" : "border-[#E2EBF0] bg-[#F8FBFC] text-[#5F7E91]", "px-2 py-0.5 text-[10px] font-extrabold capitalize")}>{member.role}</Badge>}</td><td className="px-4 py-3.5 text-[11px]">{formatDate(member.joinedAt)}</td><td className="px-5 py-3.5 text-right sm:px-6">{isOwner ? <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9BAAB3]">—</span> : <div className="inline-flex gap-1.5"><Button variant="outline" size="sm" disabled={setRole.isPending} onClick={() => setRole.mutate({ workspaceId: workspace?.id ?? "", userId: member.userId, role: member.role === "admin" ? "user" : "admin" })} className="h-7 px-2 text-[10px] text-[#2B789F]"><ArrowLeftRight className="mr-1 h-3 w-3" />{member.role === "admin" ? "Demote" : "Promote"}</Button><Button variant="outline" size="sm" disabled={removeMember.isPending} onClick={() => { setRemoveTarget({ userId: member.userId, name: member.name ?? member.email ?? "this member" }); setRemovalConfirmation(""); }} className="h-7 border-[#F0D9D5] px-2 text-[10px] text-[#C9554B] hover:bg-[#FFF3F1]"><Trash2 className="mr-1 h-3 w-3" />Remove</Button></div>}</td></tr>; })}</tbody></table></div></section></div>{removeTarget && <ConfirmDelete open onOpenChange={open => { if (!open) setRemoveTarget(null); }} title={`Remove ${removeTarget.name}?`} description="They immediately lose access to this workspace, its projects, and its tasks. Their past task activity stays in the history." value={removalConfirmation} expected={removeTarget.name} pending={removeMember.isPending} onChange={setRemovalConfirmation} onConfirm={() => removeMember.mutate({ workspaceId: workspace?.id ?? "", userId: removeTarget.userId })} />}
  </main>;
}
