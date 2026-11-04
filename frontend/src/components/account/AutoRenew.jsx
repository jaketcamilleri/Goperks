import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "");

/** Automatic yearly renewal: shows the next renewal date and lets the member turn it off or back on. */
export function AutoRenew() {
  const { refresh } = useAuth();
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/me/subscription").then((r) => setSub(r.data)).catch(() => setSub(null)); }, []);
  if (!sub?.has_subscription) return null;

  const toggle = async () => {
    if (sub.auto_renew && !window.confirm("Turn off automatic renewal? Your membership will still run until it ends, then stop.")) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/me/subscription/${sub.auto_renew ? "cancel" : "resume"}`);
      setSub(data); await refresh();
      toast.success(data?.auto_renew ? "Automatic renewal is back on" : "Automatic renewal turned off");
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F3F8F7] px-4 py-3" data-testid="auto-renew">
      <p className="flex items-start gap-2 text-sm">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[#17434C]" />
        <span data-testid="auto-renew-status">
          {sub.auto_renew ? <>Renews automatically on <b>{day(sub.renews_on)}</b> for $49.</> : <>Automatic renewal is off. Your membership won't renew on {day(sub.renews_on)}.</>}
        </span>
      </p>
      <button onClick={toggle} disabled={busy} data-testid="auto-renew-toggle-btn"
        className="rounded-full border border-[#17434C] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#17434C] hover:text-[#EAF6F3] disabled:opacity-50">
        {busy ? "Saving…" : sub.auto_renew ? "Turn off auto-renew" : "Turn auto-renew back on"}
      </button>
    </div>
  );
}
