import { BellRing } from "lucide-react";

const daysSince = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

/** Prospects marked Contacted more than a week ago, so the owner knows who to chase. */
export function FollowUpPanel({ prospects, onStatus, onOpen }) {
  const due = prospects.filter((p) => p.follow_up).sort((a, b) => a.contacted_at.localeCompare(b.contacted_at));
  if (!due.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-[#F1D9A6] bg-[#FEF4DC] p-4 sm:p-5" data-testid="follow-up-panel">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-[#7A5310]"><BellRing className="h-5 w-5" /> Time to chase up {due.length}</h2>
      <p className="text-sm text-[#7A5310]">Marked Contacted over a week ago with no update since.</p>
      <ul className="mt-3 divide-y divide-[#F1D9A6]">
        {due.slice(0, 8).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2" data-testid={`follow-up-${p.id}`}>
            <button onClick={() => onOpen(p)} className="min-w-0 flex-1 text-left">
              <span className="font-semibold text-[#17434C]">{p.business_name}</span>
              <span className="block text-xs text-[#7A5310]">{p.suburb} · contacted {daysSince(p.contacted_at)} days ago{p.phone ? ` · ${p.phone}` : ""}</span>
            </button>
            <button onClick={() => onStatus(p, "interested")} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#2F5A3A] hover:bg-[#EBF3EC]" data-testid={`follow-up-interested-${p.id}`}>Interested</button>
            <button onClick={() => onStatus(p, "not_interested")} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#9A4024] hover:bg-[#FDF0EC]" data-testid={`follow-up-no-${p.id}`}>Not interested</button>
          </li>
        ))}
      </ul>
      {due.length > 8 && <p className="mt-1 text-xs text-[#7A5310]">Use the "Chase up" filter below to see all {due.length}.</p>}
    </section>
  );
}
