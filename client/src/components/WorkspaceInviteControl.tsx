import { useEffect, useRef, useState } from "react";
import { Link2, Settings2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const inviteTokenPattern = /^[a-f0-9]{32}$/i;

export function WorkspaceInviteControl() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const acceptedTokenRef = useRef<string | null>(null);
  const workspaceQuery = trpc.tasknest.workspace.current.useQuery(undefined, { enabled: isAuthenticated });
  const workspace = workspaceQuery.data?.workspace;
  const createInvite = trpc.tasknest.workspace.createInvite.useMutation({
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

  if (!isAuthenticated || !workspace) return null;

  const inviteUrl = createInvite.data ? `${window.location.origin}/?invite=${createInvite.data.token}` : "";

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invitation link copied. It expires in 7 days.");
    } catch {
      toast.error("Copy the invitation link manually.");
    }
  };

  return <>
    {user?.role === "admin" && <a href="/admin/access" className="fixed bottom-18 right-4 z-40 inline-flex h-10 items-center rounded-full border border-[#D5E7F0] bg-white px-3.5 text-[10px] font-extrabold text-[#2E789F] shadow-[0_8px_20px_rgba(28,77,105,0.13)] transition-colors hover:bg-[#F1F8FC] sm:bottom-20 sm:right-6"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Access settings</a>}
    <Button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-40 h-11 rounded-full bg-[#247EAF] px-4 text-[11px] font-extrabold shadow-[0_10px_25px_rgba(36,126,175,0.28)] hover:bg-[#176A98] sm:bottom-6 sm:right-6" aria-label="Invite teammates to this workspace">
      <UsersRound className="mr-1.5 h-4 w-4" />Invite teammates
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite teammates</DialogTitle>
          <DialogDescription>Create a secure link for people who should collaborate in {workspace.name}. Each link can be used once and expires after 7 days.</DialogDescription>
        </DialogHeader>
        {createInvite.data ? <div className="space-y-2">
          <label className="text-sm font-semibold text-[#395269]" htmlFor="workspace-invite-link">Secure invitation link</label>
          <Input id="workspace-invite-link" readOnly value={inviteUrl} className="bg-[#F7FAFB] text-xs" />
          <p className="text-xs leading-5 text-[#718A9A]">Share this private link only with people you want to add to the workspace.</p>
        </div> : <div className="rounded-xl border border-dashed border-[#D7E5EB] bg-[#F8FBFC] p-4 text-sm leading-6 text-[#5B7484]">Generate a one-time invite link, then send it through your usual team channel.</div>}
        <DialogFooter className="gap-2 sm:gap-0">
          {createInvite.data ? <Button type="button" onClick={copyInvite} className="bg-[#38A9F2] hover:bg-[#248FCC]"><Link2 className="mr-1.5 h-4 w-4" />Copy invite link</Button> : <Button type="button" disabled={createInvite.isPending} onClick={() => createInvite.mutate({ workspaceId: workspace.id })} className="bg-[#38A9F2] hover:bg-[#248FCC]"><UsersRound className="mr-1.5 h-4 w-4" />{createInvite.isPending ? "Creating…" : "Create invite link"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
