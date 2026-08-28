import { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Mail, RefreshCw, Settings2, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const inviteTokenPattern = /^[a-f0-9]{32}$/i;

function formatExpiry(value: Date) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function WorkspaceInviteControl() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const acceptedTokenRef = useRef<string | null>(null);
  const workspaceQuery = trpc.tasknest.workspace.current.useQuery(undefined, { enabled: isAuthenticated });
  const workspace = workspaceQuery.data?.workspace;
  const workspaceId = workspace?.id;
  const workspaceInput = useMemo(() => ({ workspaceId: workspaceId ?? 1 }), [workspaceId]);
  const pendingInvites = trpc.tasknest.workspace.pendingInvites.useQuery(workspaceInput, { enabled: isAuthenticated && open && workspaceId !== undefined });
  const createInvite = trpc.tasknest.workspace.createInvite.useMutation({
    onSuccess: async invite => {
      await utils.tasknest.workspace.pendingInvites.invalidate(workspaceInput);
      toast.success(`Invitation link created for ${invite.recipientEmail}.`);
    },
    onError: error => toast.error(error.message),
  });
  const revokeInvite = trpc.tasknest.workspace.revokeInvite.useMutation({
    onSuccess: async () => {
      await utils.tasknest.workspace.pendingInvites.invalidate(workspaceInput);
      toast.success("Invitation link revoked.");
    },
    onError: error => toast.error(error.message),
  });
  const sendInviteEmail = trpc.tasknest.workspace.sendInviteEmail.useMutation({
    onSuccess: invite => toast.success(`Invitation email sent for invite #${invite.inviteId}.`),
    onError: error => toast.error(error.message),
  });
  const acceptInvite = trpc.tasknest.workspace.acceptInvite.useMutation({
    onSuccess: async () => {
      await utils.tasknest.workspace.current.invalidate();
      window.history.replaceState({}, "", window.location.pathname);
      toast.success("You joined the TaskNest workspace.");
    },
    onError: error => toast.error(error.message),
  });

  const inviteToken = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("invite");

  useEffect(() => {
    if (!isAuthenticated || !inviteToken || !inviteTokenPattern.test(inviteToken) || acceptedTokenRef.current === inviteToken) return;
    acceptedTokenRef.current = inviteToken;
    acceptInvite.mutate({ token: inviteToken });
  }, [acceptInvite, inviteToken, isAuthenticated]);

  if (!isAuthenticated || !workspace || !workspaceId) return null;

  const inviteUrl = createInvite.data ? `${window.location.origin}/?invite=${createInvite.data.token}` : "";
  const resetCreatedInvite = () => {
    createInvite.reset();
    setRecipientEmail("");
  };
  const createInvitation = () => {
    const email = recipientEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Enter the teammate’s email address.");
      return;
    }
    createInvite.mutate({ workspaceId, recipientEmail: email });
  };
  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invitation link copied. It expires in 7 days.");
    } catch {
      toast.error("Copy the invitation link manually.");
    }
  };
  const emailInvite = (inviteId: number) => sendInviteEmail.mutate({ inviteId, appOrigin: window.location.origin });
  const closeDialog = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) resetCreatedInvite();
  };

  return <>
    {user?.role === "admin" && <a href="/admin/access" className="fixed bottom-18 right-4 z-40 inline-flex h-10 items-center rounded-full border border-[#D5E7F0] bg-white px-3.5 text-[10px] font-extrabold text-[#2E789F] shadow-[0_8px_20px_rgba(28,77,105,0.13)] transition-colors hover:bg-[#F1F8FC] sm:bottom-20 sm:right-6"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Access settings</a>}
    <Button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 h-11 rounded-full bg-[#247EAF] px-4 text-[11px] font-extrabold shadow-[0_10px_25px_rgba(36,126,175,0.28)] hover:bg-[#176A98] sm:bottom-6 sm:right-6" aria-label="Invite teammates to this workspace">
      <UsersRound className="mr-1.5 h-4 w-4" />Invite teammates
    </Button>
    <Dialog open={open} onOpenChange={closeDialog}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite teammates</DialogTitle>
          <DialogDescription>Send a private, one-time TaskNest invitation to a teammate. Active invitations expire after 7 days unless you revoke them sooner.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-[#DCE8EE] bg-[#F8FBFC] p-4">
          <label className="text-sm font-semibold text-[#395269]" htmlFor="workspace-invite-email">Teammate email</label>
          <div className="flex gap-2">
            <Input id="workspace-invite-email" type="email" autoComplete="email" value={recipientEmail} onChange={event => setRecipientEmail(event.target.value)} onKeyDown={event => { if (event.key === "Enter") createInvitation(); }} placeholder="teammate@example.com" />
            <Button type="button" disabled={createInvite.isPending} onClick={createInvitation} className="shrink-0 bg-[#38A9F2] hover:bg-[#248FCC]"><UsersRound className="mr-1.5 h-4 w-4" />{createInvite.isPending ? "Creating…" : "Create"}</Button>
          </div>
        </div>
        {createInvite.data && <div className="space-y-3 rounded-xl border border-[#DDEAF0] bg-white p-4">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#2E85B5]">New invitation</p><p className="mt-1 text-sm font-bold text-[#27445D]">{createInvite.data.recipientEmail}</p></div>
          <Input id="workspace-invite-link" aria-label="Secure invitation link" readOnly value={inviteUrl} className="bg-[#F7FAFB] text-xs" />
          <div className="flex flex-wrap gap-2"><Button type="button" size="sm" onClick={copyInvite} variant="outline"><Link2 className="mr-1.5 h-3.5 w-3.5" />Copy link</Button><Button type="button" size="sm" disabled={sendInviteEmail.isPending} onClick={() => emailInvite(createInvite.data.id)} className="bg-[#247EAF] hover:bg-[#176A98]"><Mail className="mr-1.5 h-3.5 w-3.5" />{sendInviteEmail.isPending ? "Sending…" : "Send email"}</Button></div>
        </div>}
        <section className="border-t border-[#E5EDF2] pt-4">
          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-[#27445D]">Pending invitations</h3><p className="mt-0.5 text-[11px] text-[#718A9A]">People who have not joined yet.</p></div><Button type="button" size="icon" variant="ghost" onClick={() => pendingInvites.refetch()} disabled={pendingInvites.isFetching} aria-label="Refresh pending invitations"><RefreshCw className={pendingInvites.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></Button></div>
          <div className="mt-3 space-y-2">{pendingInvites.isLoading ? <p className="rounded-xl border border-dashed border-[#D7E5EB] p-3 text-xs text-[#718A9A]">Loading active invitations…</p> : pendingInvites.data?.length ? pendingInvites.data.map(invite => <article key={invite.id} className="flex items-center gap-3 rounded-xl border border-[#E2EBF0] bg-white p-3"><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-[#294A62]">{invite.recipientEmail || "Legacy invitation link"}</p><p className="mt-1 text-[10px] font-medium text-[#78909F]">Expires {formatExpiry(invite.expiresAt)}</p></div><div className="flex shrink-0 gap-1"><Button type="button" size="icon" variant="ghost" disabled={!invite.recipientEmail || sendInviteEmail.isPending} onClick={() => emailInvite(invite.id)} aria-label={`Send invitation email to ${invite.recipientEmail || "invitee"}`}><Mail className="h-3.5 w-3.5 text-[#2778A9]" /></Button><Button type="button" size="icon" variant="ghost" disabled={revokeInvite.isPending} onClick={() => revokeInvite.mutate({ inviteId: invite.id })} aria-label={`Revoke invitation for ${invite.recipientEmail || "invitee"}`}><Trash2 className="h-3.5 w-3.5 text-[#D44A3F]" /></Button></div></article>) : <p className="rounded-xl border border-dashed border-[#D7E5EB] bg-[#FBFDFE] p-4 text-center text-xs leading-5 text-[#718A9A]">No active invitations. Create one when a teammate is ready to join.</p>}</div>
        </section>
        <DialogFooter><Button type="button" variant="outline" onClick={() => closeDialog(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
