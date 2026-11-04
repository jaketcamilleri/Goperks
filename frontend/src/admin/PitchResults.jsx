import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Per pitch version: businesses pitched, how many signed up as partners, and how many are approved. */
export function PitchResults({ refresh }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/admin/prospects/pitch-results").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  }, [refresh]);
  if (!rows.length) return null;
  return (
    <section className="mb-6" data-testid="pitch-results">
      <h2 className="font-display text-lg font-semibold">Pitch results</h2>
      <p className="text-sm text-[#3D5E65]">Signed up means a partner account was made with the pitched email, or you marked them Joined.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-2xl border border-[#D7E7E4] bg-white p-4" data-testid={`pitch-result-${r.key}`}>
            <p className="truncate font-semibold">{r.name}</p>
            <div className="mt-2 flex items-end gap-5">
              <div><p className="font-display text-3xl font-semibold leading-none" data-testid={`pitch-result-rate-${r.key}`}>{r.rate}%</p><p className="mt-1 text-xs text-[#3D5E65]">signed up</p></div>
              <dl className="grid grid-cols-3 gap-3 text-xs text-[#3D5E65]">
                <div><dt>Pitched</dt><dd className="text-base font-bold text-[#17434C]" data-testid={`pitch-result-sent-${r.key}`}>{r.sent}</dd></div>
                <div><dt>Signed up</dt><dd className="text-base font-bold text-[#17434C]" data-testid={`pitch-result-signed-${r.key}`}>{r.signed_up}</dd></div>
                <div><dt>Approved</dt><dd className="text-base font-bold text-[#17434C]" data-testid={`pitch-result-approved-${r.key}`}>{r.approved}</dd></div>
              </dl>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#E3F0ED]"><div className="h-full rounded-full bg-[#B9512E] transition-[width] duration-700" style={{ width: `${r.rate}%` }} /></div>
          </div>
        ))}
      </div>
    </section>
  );
}
