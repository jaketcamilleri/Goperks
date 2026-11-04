import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Stars } from "@/components/Stars";

/** Partner portal: latest member reviews of this business's deals. */
export function PartnerReviews() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get("/business/reviews").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  }, []);
  if (rows === null) return null;
  const avg = rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  return (
    <section className="mt-10 rounded-[24px] border border-[#C2DEDA] bg-white p-6" data-testid="partner-reviews">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Member reviews</h2>
        {rows.length > 0 && <p className="flex items-center gap-2 text-sm"><Stars value={avg} /> <b>{avg.toFixed(1)}</b> from {rows.length} review{rows.length === 1 ? "" : "s"}</p>}
      </div>
      {rows.length === 0 ? <p className="mt-3 text-sm text-[#3D5E65]" data-testid="partner-reviews-empty">No reviews yet. Members can rate your deals after they use them.</p> : (
        <ul className="mt-4 divide-y divide-[#E3F0ED]">
          {rows.slice(0, 8).map((r) => (
            <li key={r.id} className="py-3" data-testid={`partner-review-${r.id}`}>
              <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{r.name} · <span className="font-normal text-[#3D5E65]">{r.deal_title}</span></span><Stars value={r.rating} size="h-3.5 w-3.5" /></div>
              {r.comment && <p className="mt-1 text-[#17434C]">{r.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
