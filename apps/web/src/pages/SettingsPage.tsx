import { Link } from "wouter";
import { ArrowLeft, Check, Moon, Sun, Monitor } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme, type Theme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun; hint: string }> = [
  { value: "light", label: "Light", icon: Sun, hint: "Porcelain surfaces, blue ink" },
  { value: "dark", label: "Dark", icon: Moon, hint: "Soft navy, low glare" },
  { value: "system", label: "System", icon: Monitor, hint: "Follow your device" },
];

/** Settings page: theme, layout density, and email digest preferences. */
export default function SettingsPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const { theme, setTheme, switchable } = useTheme();
  const utils = trpc.useUtils();

  const setPreferences = trpc.user.setPreferences.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Preferences saved.");
    },
    onError: error => toast.error(error.message),
  });

  const density = user?.preferences?.density ?? "comfortable";
  const emailDigest = user?.preferences?.emailDigest ?? true;

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] text-sm font-bold text-[#5F7E91]">Opening settings…</main>;
  }

  if (!isAuthenticated || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F7FAFB] p-5"><section className="w-full max-w-lg rounded-[28px] border border-[#D8EAF3] bg-white p-8 shadow-[0_20px_60px_rgba(26,74,98,0.09)]"><h1 className="font-['DM_Serif_Display'] text-3xl text-[#172B4D]">Sign in to change settings.</h1></section></main>;
  }

  return <main className="min-h-screen bg-[#F7FAFB] text-[#172B4D]"><header className="border-b border-[#DFE9EE] bg-white"><div className="mx-auto flex min-h-18 max-w-3xl items-center justify-between gap-4 px-5 py-3 lg:px-8"><div className="flex min-w-0 items-center gap-3"><Link href="/" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DDE8EE] text-[#4A7189] transition-colors hover:bg-[#F1F7FA]" aria-label="Back to workspace"><ArrowLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#2E85B5]">Your account</p><h1 className="truncate font-['DM_Serif_Display'] text-[23px] text-[#1F4260]">Settings</h1></div></div></div></header><div className="mx-auto max-w-3xl px-5 py-8 lg:px-8"><section className="rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><h2 className="text-base font-extrabold text-[#233F59]">Appearance</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Color theme applies instantly and is remembered on this device.</p><div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Color theme">{THEME_OPTIONS.map(option => { const Icon = option.icon; const active = switchable && theme === option.value; return <button key={option.value} type="button" role="radio" aria-checked={active} disabled={!switchable} onClick={() => setTheme(option.value)} className={cn("rounded-xl border p-3 text-left transition-colors", active ? "border-[#38A9F2] bg-[#EAF6FF]" : "border-[#DFE9EE] bg-[#F8FBFC] hover:bg-[#F1F7FA]")}> <Icon className="h-4 w-4 text-[#2474A3]" /> <span className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-[#233F59]">{option.label}{active && <Check className="h-3.5 w-3.5 text-[#2E85B5]" />}</span> <span className="mt-0.5 block text-[10px] leading-4 text-[#718A9A]">{option.hint}</span></button>; })}</div></section><section className="mt-6 rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><h2 className="text-base font-extrabold text-[#233F59]">Layout density</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">Compact tightens spacing across boards and lists so more work fits on screen.</p><div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Layout density">{([{ value: "comfortable", label: "Comfortable", hint: "Roomy spacing" }, { value: "compact", label: "Compact", hint: "Dense, more on screen" }] as const).map(option => { const active = density === option.value; return <button key={option.value} type="button" role="radio" aria-checked={active} onClick={() => setPreferences.mutate({ density: option.value })} disabled={setPreferences.isPending} className={cn("rounded-xl border p-3 text-left transition-colors", active ? "border-[#38A9F2] bg-[#EAF6FF]" : "border-[#DFE9EE] bg-[#F8FBFC] hover:bg-[#F1F7FA]")}> <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#233F59]">{option.label}{active && <Check className="h-3.5 w-3.5 text-[#2E85B5]" />}</span> <span className="mt-0.5 block text-[10px] text-[#718A9A]">{option.hint}</span></button>; })}</div></section><section className="mt-6 rounded-2xl border border-[#DDE8EE] bg-white p-6 shadow-[0_10px_26px_rgba(28,77,105,0.035)]"><div className="flex items-start justify-between gap-4"><div><h2 className="text-base font-extrabold text-[#233F59]">Email digest</h2><p className="mt-1 text-xs leading-5 text-[#718A9A]">A daily "your day" email with due-today and overdue work.</p></div><Switch checked={emailDigest} onCheckedChange={checked => setPreferences.mutate({ emailDigest: checked })} disabled={setPreferences.isPending} aria-label="Email digest" /></div><Label className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8498A5]"><span className={cn("h-1.5 w-1.5 rounded-full", emailDigest ? "bg-[#6EBB92]" : "bg-[#C9554B]")} />{emailDigest ? "Digests are on" : "Digests are off"}</Label></section></div></main>;
}
