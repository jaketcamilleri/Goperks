import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { api } from "@/lib/api";

/** Prompts members to rate deals they've used but not reviewed yet. */
export function RateVisits({ refreshKey }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/me/to-review").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  }, [refreshKey]);
  if (!rows.length) return null;
  return (
    <section className="mt-8 rounded-2xl border border-[#F2D6A2] bg-[#FEF8EC] p-5" data-testid="rate-visits">
      <p className="flex items-center gap-2 font-display text-xl font-semibold"><Star className="h-5 w-5 text-[#E39A2D]" fill="currentColor" strokeWidth={0} /> How were your visits?</p>
      <p className="mt-1 text-sm text-[#3D5E65]">Your rating helps other members pick their next outing.</p>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.deal_id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3" data-testid={`rate-visit-${r.deal_id}`}>
            <span className="min-w-0"><span className="block truncate font-semibold">{r.deal_title}</span><span className="block truncate text-xs text-[#3D5E65]">{r.business_name}</span></span>
            <Link to={`/deals/${r.deal_id}#reviews`} className="shrink-0 rounded-full bg-[#17434C] px-4 py-2 text-sm font-semibold text-[#EAF6F3]" data-testid={`rate-visit-btn-${r.deal_id}`}>Rate it</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
