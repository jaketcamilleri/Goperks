import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PartyPopper } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";

const input = "mt-1 h-10 w-full rounded-lg border border-[#D7E7E4] px-3 text-sm font-normal outline-none focus:border-[#17434C]";

/** Owner switch + dates for the launch-week half-price offer shown on the home page and applied at checkout. */
export function LaunchOfferSettings() {
  const [f, setF] = useState({ enabled: false, starts_on: "", ends_on: "" });
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/admin/launch-offer").then((r) => {
      const d = r.data || {};
      setF({ enabled: !!d.enabled, starts_on: d.starts_on || "", ends_on: d.ends_on || "" }); setLive(!!d.live);
    }).catch(() => {});
  }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: k === "enabled" ? e.target.checked : e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/launch-offer", f);
      setLive(!!data?.live);
      toast.success(data?.live ? "Launch offer is live on the home page" : "Launch offer saved");
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <section className="mb-5 rounded-2xl border border-[#D7E7E4] bg-white p-4" data-testid="launch-offer-settings">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-semibold"><PartyPopper className="h-4 w-4 text-[#B9512E]" /> Launch week offer</p>
        <span className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase ${live ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#EAF6F3] text-[#3D5E65]"}`} data-testid="launch-offer-status">
          {live ? "Live now" : "Not showing"}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[#3D5E65]">New members pay $24.50 for their first year (instead of $49) between these dates. Shows a banner on the home page and applies at checkout. Renewals are full price.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex h-10 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={f.enabled} onChange={set("enabled")} className="h-4 w-4 accent-[#B9512E]" data-testid="launch-offer-enabled" /> Offer on
        </label>
        <label className="text-sm font-semibold">Starts<input type="date" value={f.starts_on} onChange={set("starts_on")} className={input} data-testid="launch-offer-start" /></label>
        <label className="text-sm font-semibold">Ends<input type="date" value={f.ends_on} onChange={set("ends_on")} min={f.starts_on || undefined} className={input} data-testid="launch-offer-end" /></label>
        <button onClick={save} disabled={busy || !f.starts_on || !f.ends_on} className={btn.primary} data-testid="launch-offer-save-btn">{busy ? "Saving…" : "Save"}</button>
      </div>
    </section>
  );
}
