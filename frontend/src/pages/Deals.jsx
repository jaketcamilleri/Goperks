import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { api, CATEGORIES } from "@/lib/api";
import { DealCard } from "@/components/DealCard";
import { MaskLines, Eyebrow } from "@/components/Reveal";

export default function Deals() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "all";
  const [q, setQ] = useState("");
  const [deals, setDeals] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/deals", { params: { category, q: q || undefined } })
        .then((r) => setDeals(Array.isArray(r.data) ? r.data : []))
        .catch(() => setDeals([]));
    }, 250);
    return () => clearTimeout(t);
  }, [category, q]);

  const pills = [{ key: "all", label: "All deals" }, ...CATEGORIES];

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8 lg:pt-20" data-testid="deals-directory">
      <Eyebrow>The directory</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
        lines={[<>Where to <em className="font-normal italic text-[#D95329]">first?</em></>]} />
      <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" data-lenis-prevent>
          {pills.map((p) => (
            <button key={p.key} data-testid={`filter-${p.key}`}
              onClick={() => setParams(p.key === "all" ? {} : { category: p.key })}
              className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${category === p.key ? "border-[#1E2229] bg-[#1E2229] text-[#FBF8F3]" : "border-[#E0D7C3] bg-white hover:border-[#1E2229]"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525B68]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals or suburbs" data-testid="deals-search-input"
            className="h-12 w-full rounded-full border border-[#E0D7C3] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1E2229]" />
        </label>
      </div>

      {deals === null ? (
        <p className="mt-16 font-mono text-sm text-[#525B68]">Loading deals…</p>
      ) : deals.length === 0 ? (
        <p className="mt-16 font-display text-2xl text-[#525B68]" data-testid="deals-empty">No deals here yet — check back soon.</p>
      ) : (
        <div className="mt-14 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" data-testid="deals-grid">
          {deals.map((d, i) => <DealCard key={d.id} deal={d} index={i} />)}
        </div>
      )}
    </div>
  );
}
