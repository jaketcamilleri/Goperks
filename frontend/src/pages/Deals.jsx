import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, Map as MapIcon, LocateFixed, Loader2, X } from "lucide-react";
import { api, CATEGORIES } from "@/lib/api";
import { DealCard } from "@/components/DealCard";
import { DealsMap } from "@/components/DealsMap";
import { MaskLines, Eyebrow } from "@/components/Reveal";
import { useMyLocation, sortNearby } from "@/lib/nearby";

const LOC_MSG = { denied: "Location is blocked. Allow it in your browser settings to see deals near you.", error: "Couldn't find your location. Please try again.", unsupported: "Your browser can't share location." };

function NearMeButton({ state, locate, clear }) {
  const on = state === "on";
  return (
    <button onClick={on ? clear : locate} disabled={state === "locating"} data-testid="near-me-btn" aria-pressed={on}
      className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition-colors disabled:opacity-70 ${on ? "border-[#B9512E] bg-[#B9512E] text-[#EAF6F3]" : "border-[#C2DEDA] bg-white hover:border-[#17434C]"}`}>
      {state === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? <X className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
      {state === "locating" ? "Finding you…" : "Near me"}
    </button>
  );
}

export default function Deals() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "all";
  const suburb = params.get("suburb") || "";
  const [q, setQ] = useState("");
  const [deals, setDeals] = useState(null);
  const [suburbs, setSuburbs] = useState([]);
  const [view, setView] = useState("grid");
  const { me, state: locState, locate, clear } = useMyLocation();
  const shown = deals && me ? sortNearby(deals, me) : deals;

  useEffect(() => {
    api.get("/suburbs").then((r) => setSuburbs(Array.isArray(r.data) ? r.data : [])).catch(() => setSuburbs([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/deals", { params: { category, q: q || undefined, suburb: suburb || undefined } })
        .then((r) => setDeals(Array.isArray(r.data) ? r.data : []))
        .catch(() => setDeals([]));
    }, 250);
    return () => clearTimeout(t);
  }, [category, q, suburb]);

  const update = (patch) => {
    const next = { category, suburb, ...patch };
    const clean = {};
    if (next.category && next.category !== "all") clean.category = next.category;
    if (next.suburb) clean.suburb = next.suburb;
    setParams(clean);
  };

  const pills = [{ key: "all", label: "All deals" }, ...CATEGORIES];
  const toggleBtn = (v, Icon, label) => (
    <button onClick={() => setView(v)} data-testid={`view-${v}`} aria-label={label}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${view === v ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65]"}`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8 lg:pt-20" data-testid="deals-directory">
      <Eyebrow>The directory</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
        lines={[<>Where to <em className="font-normal italic text-[#B9512E]">first?</em></>]} />
      <div className="-mx-5 mt-10 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:px-0" data-lenis-prevent>
        {pills.map((p) => (
          <button key={p.key} data-testid={`filter-${p.key}`} onClick={() => update({ category: p.key })}
            className={`shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors ${category === p.key ? "border-[#17434C] bg-[#17434C] text-[#EAF6F3]" : "border-[#C2DEDA] bg-white hover:border-[#17434C]"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block w-full md:w-80">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3D5E65]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals" data-testid="deals-search-input"
            className="h-12 w-full rounded-full border border-[#C2DEDA] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#17434C]" />
        </label>
        <select value={suburb} onChange={(e) => update({ suburb: e.target.value })} data-testid="suburb-select"
          className="h-12 w-full rounded-full border border-[#C2DEDA] bg-white px-5 text-sm font-semibold outline-none focus:border-[#17434C] md:w-60">
          <option value="">All suburbs</option>
          {suburbs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <NearMeButton state={locState} locate={locate} clear={clear} />
        <div className="flex w-fit rounded-full border border-[#C2DEDA] bg-white p-1 md:ml-auto">
          {toggleBtn("grid", LayoutGrid, "List")}
          {toggleBtn("map", MapIcon, "Map")}
        </div>
      </div>
      {LOC_MSG[locState] && <p className="mt-3 text-sm text-[#9A4024]" data-testid="near-me-error">{LOC_MSG[locState]}</p>}
      {locState === "on" && <p className="mt-3 text-sm text-[#3D5E65]" data-testid="near-me-note">Showing places open now first, then the closest to you.</p>}

      {deals === null ? (
        <p className="mt-16 font-mono text-sm text-[#3D5E65]">Loading deals…</p>
      ) : view === "map" ? (
        <div className="mt-10"><DealsMap deals={deals} /></div>
      ) : deals.length === 0 ? (
        <p className="mt-16 font-display text-2xl text-[#3D5E65]" data-testid="deals-empty">No deals here yet — check back soon.</p>
      ) : (
        <div className="mt-14 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3" data-testid="deals-grid">
          {shown.map((d, i) => <DealCard key={d.id} deal={d} index={i} />)}
        </div>
      )}
    </div>
  );
}
