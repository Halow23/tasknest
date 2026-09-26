import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { PageLoading } from "@/components/Loading";

function initials(value: string | null | undefined) {
  const words = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "ME";
  return words.slice(0, 2).map(word => word[0]!.toUpperCase()).join("");
}

/** Profile page: avatar (Google photo or custom upload), display name, account info. */
export default function ProfilePage() {
  const { user, firebaseUser, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user && !name) setName(user.name ?? user.email ?? "");
  }, [user, name]);

  const save = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Profile updated.");
    },
    onError: error => toast.error(error.message),
  });
  const presign = trpc.user.presignAvatar.useMutation();

  const handleAvatarUpload = async (file: File) => {
    setUploading(true);
    try {
      const presignData = await presign.mutateAsync({ filename: file.name });
      const form = new FormData();
      for (const [key, value] of Object.entries(presignData.uploadParams)) form.append(key, String(value));
      form.append("file", file);
      const response = await fetch(presignData.uploadUrl, { method: "POST", body: form });
      if (!response.ok) throw new Error(`Upload failed (${response.status})`);
      await save.mutateAsync({ name: (name.trim() || user?.name || "TaskNest member"), photoURL: presignData.publicUrl });
      toast.success("Avatar updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  if (loading) {
    return <PageLoading label="Opening profile" />;
  }

  if (!isAuthenticated || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#D8EAF3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><h1 className="font-['DM_Serif_Display'] text-3xl text-[#172B4D]">Sign in to view your profile.</h1></section></main>;
  }

  const photoURL = user.photoURL ?? firebaseUser?.photoURL ?? null;
  const dirty = name.trim() !== (user.name ?? "") && Boolean(name.trim());

  return <main className="min-h-screen bg-[#F7FAFB] text-[#172B4D]"><header className="border-b border-[#DFE9EE] bg-white"><div className="mx-auto flex min-h-18 max-w-3xl items-center justify-between gap-4 px-5 py-3 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Link href="/" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE8EE] text-[#4A7189] transition-colors hover:bg-[#F1F7FA]" aria-label="Back to workspace"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2E85B5]">Your account</p><h1 className="truncate font-['DM_Serif_Display'] text-[23px] text-[#1F4260]">Profile</h1></div></div></div></header><div className="mx-auto max-w-3xl px-5 py-8 lg:px-8"><section className="rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><h2 className="text-base font-extrabold text-[#233F59]">Avatar</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Shown next to your work across the workspace. Upload a square image for best results.</p><div className="mt-5 flex items-center gap-5"><Avatar className="h-20 w-20 border border-[#DFE9EE]">{photoURL ? <AvatarImage src={photoURL} alt={user.name ?? "Your avatar"} /> : null}<AvatarFallback className="bg-[#EAF6FF] text-lg font-extrabold text-[#2474A3]">{initials(user.name ?? user.email)}</AvatarFallback></Avatar><div className="flex flex-col gap-2"><input ref={fileInput} type="file" accept="image/*" className="hidden" aria-hidden="true" onChange={event => { const file = event.target.files?.[0]; if (file) void handleAvatarUpload(file); }} /><Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>{uploading ? "Uploading…" : "Upload new photo"}</Button>{photoURL && <Button type="button" variant="ghost" size="sm" className="text-[#C9554B] hover:bg-[#FFF0EE]" onClick={() => save.mutate({ name: name.trim() || user.name || "TaskNest member", photoURL: null })}>Remove photo</Button>}</div></div></section><section className="mt-6 rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><h2 className="text-base font-extrabold text-[#233F59]">Display name</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Teammates see this name on tasks, comments, and chat.</p><div className="mt-4 max-w-md"><Label htmlFor="profile-name" className="text-xs font-bold text-[#3A5970]">Name</Label><Input id="profile-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} className="mt-2 bg-white text-sm" /><div className="mt-3 flex items-center gap-2"><Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ name: name.trim() })} className="bg-[#38A9F2] text-xs hover:bg-[#248FCC]">{save.isPending ? "Saving…" : <><Check className="mr-1 h-3.5 w-3.5" />Save changes</>}</Button>{dirty && !save.isPending && <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#A36A00]">Unsaved</span>}</div></div></section><section className="mt-6 rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><h2 className="text-base font-extrabold text-[#233F59]">Account</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-xs font-bold text-[#718A9A]">Email</dt><dd className="font-semibold text-[#31546B]">{user.email ?? "—"}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-xs font-bold text-[#718A9A]">Sign-in method</dt><dd className="font-semibold capitalize text-[#31546B]">{user.loginMethod}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-xs font-bold text-[#718A9A]">Workspace role</dt><dd className="font-semibold capitalize text-[#31546B]">{user.role}</dd></div></dl></section></div></main>;
}
