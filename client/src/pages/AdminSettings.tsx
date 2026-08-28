import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Globe2, MailCheck, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function reasonLabel(reason: "missing_email" | "email_not_approved") {
  return reason === "missing_email" ? "No email supplied" : "Not on access list";
}

export default function AdminSettings() {
  const { user, loading, isAuthenticated } = useAuth();
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const settingsQuery = trpc.accessManagement.settings.useQuery(undefined, { enabled: isAdmin });
  const deniedQuery = trpc.accessManagement.deniedSignIns.useQuery({ limit: 50 }, { enabled: isAdmin, refetchInterval: 30_000 });

  const refresh = async () => {
    await Promise.all([
      utils.accessManagement.settings.invalidate(),
      utils.accessManagement.deniedSignIns.invalidate(),
    ]);
  };

  const addDomain = trpc.accessManagement.addDomain.useMutation({
    onSuccess: async () => {
      setDomain("");
      await refresh();
      toast.success("Approved domain added.");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeDomain = trpc.accessManagement.removeDomain.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Approved domain removed.");
    },
    onError: (error) => toast.error(error.message),
  });
  const addExternal = trpc.accessManagement.addExternalEmail.useMutation({
    onSuccess: async () => {
      setEmail("");
      setNote("");
      await refresh();
      toast.success("External collaborator allowlisted.");
    },
    onError: (error) => toast.error(error.message),
  });
  const removeExternal = trpc.accessManagement.removeExternalEmail.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("External collaborator removed from the allowlist.");
    },
    onError: (error) => toast.error(error.message),
  });

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] text-sm font-bold text-[#5F7E91]">Opening access settings…</main>;
  }

  if (!isAuthenticated) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#D8EAF3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><ShieldCheck className="h-10 w-10 text-[#38A9F2]" /><p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#2E85B5]">Administrator area</p><h1 className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#172B4D]">Sign in to manage access.</h1><p className="mt-4 text-sm leading-6 text-[#587080]">Only TaskNest administrators can update access rules or review sign-in denials.</p><Button onClick={startLogin} className="mt-7 bg-[#FF6B5E] hover:bg-[#E85B50]">Sign in</Button></section></main>;
  }

  if (!isAdmin) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#F2D7D3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><AlertTriangle className="h-10 w-10 text-[#D44A3F]" /><p className="mt-7 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#C2574E]">Access restricted</p><h1 className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#172B4D]">Administrator permission required.</h1><p className="mt-4 text-sm leading-6 text-[#587080]">You can return to the workspace, but only an administrator can change sign-in rules.</p><Link href="/"><Button className="mt-7 bg-[#38A9F2] hover:bg-[#248FCC]"><ArrowLeft className="mr-1.5 h-4 w-4" />Back to workspace</Button></Link></section></main>;
  }

  const domains = settingsQuery.data?.domains ?? [];
  const externalEmails = settingsQuery.data?.emails ?? [];
  const denials = deniedQuery.data ?? [];

  return <main className="min-h-screen bg-[#F7FAFB] text-[#172B4D]"><header className="border-b border-[#DFE9EE] bg-white"><div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-4 px-5 py-3 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Link href="/" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE8EE] text-[#4A7189] transition-colors hover:bg-[#F1F7FA]" aria-label="Back to workspace"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2E85B5]">TaskNest administration</p><h1 className="truncate font-['DM_Serif_Display'] text-[23px] text-[#1F4260]">Access control</h1></div></div><Badge className="shrink-0 border-0 bg-[#EAF6FF] px-2.5 py-1 text-[10px] font-extrabold text-[#2877A6]"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Admin only</Badge></div></header><div className="mx-auto max-w-6xl px-5 py-7 lg:px-8 lg:py-10"><section className="grid gap-px overflow-hidden rounded-2xl border border-[#DDE8EE] bg-[#DDE8EE] shadow-[0_12px_35px_rgba(28,77,105,0.05)] sm:grid-cols-3"><div className="bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8197A5]">Approved domains</p><p className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#1E4563]">{domains.length}</p><p className="mt-1 text-xs font-medium text-[#718A9A]">Institution-wide access</p></div><div className="bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8197A5]">External exceptions</p><p className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#1E4563]">{externalEmails.length}</p><p className="mt-1 text-xs font-medium text-[#718A9A]">Named collaborators</p></div><div className="bg-white p-5"><p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8197A5]">Recent denials</p><p className="mt-2 font-['DM_Serif_Display'] text-4xl text-[#1E4563]">{denials.length}</p><p className="mt-1 text-xs font-medium text-[#718A9A]">Latest 50 login attempts</p></div></section><div className="mt-7 grid gap-6 xl:grid-cols-[1fr_1fr]"><section className="rounded-2xl border border-[#DDE8EE] bg-white p-5 shadow-[0_10px_26px_rgba(28,77,105,0.035)] sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EAF6FF] text-[#2779A8]"><Globe2 className="h-5 w-5" /></span><div><h2 className="text-base font-extrabold text-[#233F59]">Approved email domains</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Anyone who signs in with one of these domains may access TaskNest.</p></div></div><form onSubmit={(event) => { event.preventDefault(); if (domain.trim()) addDomain.mutate({ domain }); }} className="mt-5 rounded-xl border border-[#DFE9EE] bg-[#F8FBFC] p-3"><Label htmlFor="access-domain" className="text-xs font-bold text-[#3A5970]">Domain</Label><div className="mt-2 flex gap-2"><Input id="access-domain" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="partner.edu" autoCapitalize="none" className="bg-white text-sm" /><Button type="submit" disabled={!domain.trim() || addDomain.isPending} className="shrink-0 bg-[#38A9F2] text-xs hover:bg-[#248FCC]"><Plus className="mr-1 h-3.5 w-3.5" />Add</Button></div></form><div className="mt-4 overflow-hidden rounded-xl border border-[#E2EBF0]"><div className="border-b border-[#E7EEF2] bg-[#F6F9FA] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8499A6]">Currently approved</div>{settingsQuery.isLoading ? <p className="p-4 text-sm text-[#718A9A]">Loading approved domains…</p> : domains.length === 0 ? <p className="p-4 text-sm text-[#718A9A]">No institution-wide domains are currently configured.</p> : domains.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 border-b border-[#EEF3F5] px-3 py-3 last:border-0"><span className="min-w-0 truncate font-mono text-xs font-bold text-[#31546B]">@{record.domain}</span><Button variant="outline" size="sm" onClick={() => removeDomain.mutate({ id: record.id })} disabled={removeDomain.isPending} className="h-7 shrink-0 border-[#F0D9D5] px-2 text-[10px] text-[#C9554B] hover:bg-[#FFF3F1]"><Trash2 className="mr-1 h-3 w-3" />Remove</Button></div>)}</div></section><section className="rounded-2xl border border-[#DDE8EE] bg-white p-5 shadow-[0_10px_26px_rgba(28,77,105,0.035)] sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF0EE] text-[#D65D53]"><UsersRound className="h-5 w-5" /></span><div><h2 className="text-base font-extrabold text-[#233F59]">External collaborator allowlist</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Grant named people access without opening their whole email domain.</p></div></div><form onSubmit={(event) => { event.preventDefault(); if (email.trim()) addExternal.mutate({ email, note: note.trim() || undefined }); }} className="mt-5 rounded-xl border border-[#DFE9EE] bg-[#F8FBFC] p-3"><div className="grid gap-2 sm:grid-cols-2"><div><Label htmlFor="external-email" className="text-xs font-bold text-[#3A5970]">Email</Label><Input id="external-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="advisor@example.org" autoCapitalize="none" className="mt-2 bg-white text-sm" /></div><div><Label htmlFor="external-note" className="text-xs font-bold text-[#3A5970]">Note <span className="font-medium text-[#8BA0AD]">optional</span></Label><Input id="external-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Program advisor" className="mt-2 bg-white text-sm" /></div></div><Button type="submit" disabled={!email.trim() || addExternal.isPending} className="mt-3 bg-[#FF6B5E] text-xs hover:bg-[#E85B50]"><Plus className="mr-1 h-3.5 w-3.5" />Allow external email</Button></form><div className="mt-4 overflow-hidden rounded-xl border border-[#E2EBF0]"><div className="border-b border-[#E7EEF2] bg-[#F6F9FA] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8499A6]">Named exceptions</div>{settingsQuery.isLoading ? <p className="p-4 text-sm text-[#718A9A]">Loading allowlisted collaborators…</p> : externalEmails.length === 0 ? <p className="p-4 text-sm text-[#718A9A]">No external collaborators are allowlisted.</p> : externalEmails.map((record) => <div key={record.id} className="flex items-center justify-between gap-3 border-b border-[#EEF3F5] px-3 py-3 last:border-0"><div className="min-w-0"><p className="truncate text-xs font-bold text-[#31546B]">{record.email}</p>{record.note && <p className="mt-0.5 truncate text-[10px] text-[#7C94A2]">{record.note}</p>}</div><Button variant="outline" size="sm" onClick={() => removeExternal.mutate({ id: record.id })} disabled={removeExternal.isPending} className="h-7 shrink-0 border-[#F0D9D5] px-2 text-[10px] text-[#C9554B] hover:bg-[#FFF3F1]"><Trash2 className="mr-1 h-3 w-3" />Remove</Button></div>)}</div></section></div><section className="mt-6 overflow-hidden rounded-2xl border border-[#DDE8EE] bg-white shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5EDF1] px-5 py-5 sm:px-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFF8E6] text-[#A36A00]"><Clock3 className="h-5 w-5" /></span><div><h2 className="text-base font-extrabold text-[#233F59]">Denied sign-in audit</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">The most recent 50 rejected OAuth sign-ins. Credentials and session values are not retained.</p></div></div><Badge variant="outline" className="border-[#DCE8EE] bg-[#F9FBFC] text-[10px] font-bold text-[#6D8796]"><CheckCircle2 className="mr-1 h-3.5 w-3.5 text-[#54A677]" />Refreshes every 30 seconds</Badge></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-[#F7FAFB]"><tr className="text-[9px] font-extrabold uppercase tracking-[0.13em] text-[#8297A5]"><th className="px-5 py-3 sm:px-6">Attempted email</th><th className="px-5 py-3">Domain</th><th className="px-5 py-3">Reason</th><th className="px-5 py-3 sm:px-6">When</th></tr></thead><tbody>{deniedQuery.isLoading ? <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-[#718A9A]">Loading denied sign-ins…</td></tr> : denials.length === 0 ? <tr><td colSpan={4} className="px-5 py-10 text-center"><MailCheck className="mx-auto h-5 w-5 text-[#69AFD1]" /><p className="mt-2 text-sm font-bold text-[#4B697C]">No denied sign-ins recorded yet.</p><p className="mt-1 text-xs text-[#7A929F]">New rejected OAuth sign-ins will appear here automatically.</p></td></tr> : denials.map((event) => <tr key={event.id} className="border-t border-[#EDF2F5] text-xs text-[#456176]"><td className="px-5 py-3.5 font-semibold text-[#2E526B] sm:px-6">{event.attemptedEmail || "No email returned"}</td><td className="px-5 py-3.5 font-mono text-[11px]">{event.emailDomain ? `@${event.emailDomain}` : "—"}</td><td className="px-5 py-3.5"><Badge variant="outline" className="border-[#F3DDD4] bg-[#FFF7F4] text-[10px] font-bold text-[#BE5A4F]">{reasonLabel(event.reason)}</Badge></td><td className="px-5 py-3.5 text-[11px] font-medium text-[#6C8797] sm:px-6">{formatTimestamp(event.createdAt)}</td></tr>)}</tbody></table></div></section></div></main>;
}
