import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { ap } from "@/lib/site";
import { RevenueChart } from "@/components/RevenueChart";
import { TopDeals } from "@/components/TopDeals";
import { PageHead } from "@/admin/AdminShell";
import { useOutletContext } from "react-router-dom";

const MONEY = new Set(["revenue", "members", "active_members", "gifts_sold"]);

const CARDS = [
  ["revenue", "Revenue (A$)", (v) => `$${Math.round(v)}`], ["members", "Members"], ["active_members", "Active members"], ["gifts_sold", "Gifts sold"],
  ["businesses", "Partners"], ["live_deals", "Live deals"], ["vouchers", "Vouchers claimed"], ["redeemed", "Redeemed"],
];

function Todo({ n, label, to, id }) {
  return (
    <Link to={to} data-testid={`admin-todo-${id}`}
      className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${n ? "border-[#EE8A63] bg-[#FDF0EC] hover:bg-[#F8DDD3]" : "border-[#D7E7E4] bg-white"}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="font-display text-2xl font-semibold">{n ?? "—"}</span>
    </Link>
  );
}

export default function Overview() {
  const { role } = useOutletContext() || {};
  const owner = role === "admin";
  const [s, setS] = useState({});
  useEffect(() => { api.get("/admin/stats").then((r) => setS(r.data || {})).catch(() => {}); }, []);
  return (
    <div data-testid="admin-overview">
      <PageHead title="Overview" sub="Everything happening across Go Perks." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Todo n={s.pending_businesses} label="Businesses waiting for approval" to={ap("/businesses")} id="businesses" />
        <Todo n={s.pending_deals} label="Deals waiting for review" to={ap("/deals")} id="deals" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {CARDS.filter(([k]) => owner || !MONEY.has(k)).map(([k, label, f]) => (
          <div key={k} className="rounded-xl border border-[#D7E7E4] bg-white p-4" data-testid={`admin-stat-${k}`}>
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">{label}</p>
            <p className="mt-1 font-display text-3xl font-semibold">{s[k] == null ? "—" : f ? f(s[k]) : s[k]}</p>
          </div>
        ))}
      </div>
      {owner && <RevenueChart />}
      <TopDeals />
    </div>
  );
}
