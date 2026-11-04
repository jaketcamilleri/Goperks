import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const lastMonths = () => {
  const d = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    return { k: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, l: m.toLocaleDateString("en-AU", { month: "short", year: "2-digit" }) };
  });
};

export const TopDeals = () => {
  const months = lastMonths();
  const [month, setMonth] = useState(months[0].k);
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    api.get("/admin/top-deals", { params: { month } }).then((r) => setDeals(Array.isArray(r.data?.deals) ? r.data.deals : [])).catch(() => setDeals([]));
  }, [month]);
  const max = Math.max(1, ...deals.map((d) => d.redeemed || 0));

  return (
    <section className="mt-6 rounded-[28px] border border-[#C2DEDA] bg-white p-5 sm:p-8" data-testid="admin-top-deals">
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">Leaderboard</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Top 5 most-redeemed deals</h2>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" data-testid="top-deals-months">
        {months.map((m) => (
          <button key={m.k} onClick={() => setMonth(m.k)} data-testid={`top-deals-month-${m.k}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${month === m.k ? "bg-[#17434C] text-[#EAF6F3]" : "bg-[#EAF6F3] text-[#17434C] hover:bg-[#C2DEDA]"}`}>{m.l}</button>
        ))}
      </div>
      {deals.length === 0 ? (
        <p className="mt-6 text-[#3D5E65]" data-testid="top-deals-empty">No deals redeemed this month yet.</p>
      ) : (
        <ol className="mt-6 space-y-4">
          {deals.map((d, i) => (
            <li key={d.deal_id} className="flex items-center gap-4" data-testid={`top-deal-${i + 1}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EE8A63] font-display text-lg font-bold text-[#17434C]">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="truncate font-semibold">{d.title}</p>
                  <p className="shrink-0 font-display text-xl font-semibold" data-testid={`top-deal-${i + 1}-count`}>{d.redeemed}</p>
                </div>
                <p className="truncate text-sm text-[#3D5E65]">{d.business_name} · A${Math.round(d.saved || 0)} saved</p>
                <div className="mt-2 h-2 rounded-full bg-[#EAF6F3]"><div className="h-2 rounded-full bg-[#17434C] transition-[width] duration-500" style={{ width: `${(d.redeemed / max) * 100}%` }} /></div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
