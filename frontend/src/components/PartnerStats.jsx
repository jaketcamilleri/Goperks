import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { StatusPill } from "@/pages/Business";

function Big({ label, value, id, bg }) {
  return (
    <div className="pop rounded-[24px] border-2 border-[#17434C] p-5" style={{ background: bg }} data-testid={`partner-stat-${id}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#17434C]">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold">{value ?? 0}</p>
    </div>
  );
}

export function PartnerStats() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/business/stats").then((r) => setS(r.data || null)).catch(() => setS(null));
  }, []);
  if (!s) return null;
  const t = s.totals || {};
  const rows = Array.isArray(s.deals) ? s.deals : [];

  return (
    <section className="mt-12" data-testid="partner-stats">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-semibold">Your deal stats</h2>
        <span className="font-mono text-xs uppercase tracking-widest text-[#9A4024]">{s.month}</span>
      </div>
      <p className="mt-2 text-sm text-[#3D5E65]" data-testid="partner-report-note">We email you a summary of last month's numbers on the 1st of every month.</p>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Big id="claimed-month" label="Claimed this month" value={t.claimed_month} bg="#FFF4CE" />
        <Big id="redeemed-month" label="Redeemed this month" value={t.redeemed_month} bg="#E2F9FE" />
        <Big id="redeemed-all" label="Redeemed all time" value={t.redeemed_all} bg="#EAFCDA" />
        <Big id="saved-all" label="Members saved" value={`$${Math.round(t.saved_all || 0)}`} bg="#FFE3EC" />
      </div>
      {rows.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-[24px] border border-[#C2DEDA] bg-white" data-lenis-prevent>
          <table className="w-full min-w-[560px] text-left text-sm" data-testid="partner-stats-table">
            <thead className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">
              <tr><th className="p-4">Deal</th><th className="p-4">Status</th><th className="p-4 text-right">Claimed (month)</th><th className="p-4 text-right">Redeemed (month)</th><th className="p-4 text-right">All-time redeemed</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.deal_id} className="border-t border-[#C2DEDA]" data-testid={`partner-stats-row-${r.deal_id}`}>
                  <td className="p-4 font-semibold">{r.title}<span className="ml-2 font-normal text-[#3D5E65]">{r.discount_label}</span></td>
                  <td className="p-4"><StatusPill status={r.status} /></td>
                  <td className="p-4 text-right font-display text-lg">{r.claimed_month}</td>
                  <td className="p-4 text-right font-display text-lg">{r.redeemed_month}</td>
                  <td className="p-4 text-right font-display text-lg">{r.redeemed_all}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
