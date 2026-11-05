import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, LayoutGrid, Map as MapIcon, LocateFixed, Loader2, X, Sparkles, Timer, Clock } from "lucide-react";
import { api, CATEGORIES } from "@/lib/api";
import { DealCard } from "@/components/DealCard";
import { DealRow } from "@/components/DealRow";
import { DealsMap } from "@/components/DealsMap";
import { useMyLocation, sortNearby } from "@/lib/nearby";
import { isNew, endsSoon, sortDeals, SORTS } from "@/lib/deals";
import { Underline } from "@/components/Fun";

const LOC_MSG = { denied: "Location is blocked. Allow it in your browser settings to see deals near you.", error: "Couldn't find your location. Please try again.", unsupported: "Your browser can't share location." };
const chip = (on) => `inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${on ? "border-[#17434C] bg-[#17434C] text-[#EAF6F3]" : "border-[#C2DEDA] bg-white hover:border-[#17434C]"}`;
const select = "h-10 shrink-0 rounded-full border border-[#C2DEDA] bg-white px-4 text-sm font-semibold outline-none focus:border-[#17434C]";

function matches(d, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return [d.title, d.business_name, d.suburb, d.description, d.discount_label].some((v) => (v || "").toLowerCase().includes(s));
}

function Toolbar({ p }) {
  const { suburb, suburbs, update, locState, locate, clear, openOnly, setOpenOnly, sort, view, setView } = p;
  return (
    <div className="-mx-5 mt-3 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden" data-lenis-prevent data-testid="deals-toolbar">
      <button onClick={locState === "on" ? clear : locate} disabled={locState === "locating"} className={chip(locState === "on")} data-testid="near-me-btn" aria-pressed={locState === "on"}>
        {locState === "locating" ? <Loader2 className="h-4 w-4 animate-spin" /> : locState === "on" ? <X className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
        {locState === "locating" ? "Finding you…" : "Near me"}
      </button>
      <button onClick={() => setOpenOnly(!openOnly)} className={chip(openOnly)} aria-pressed={openOnly} data-testid="open-now-filter"><Clock className="h-4 w-4" /> Open now</button>
      <select value={suburb} onChange={(e) => update({ suburb: e.target.value })} className={select} aria-label="Suburb" data-testid="suburb-select">
        <option value="">All suburbs</option>
        {suburbs.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select value={sort} onChange={(e) => update({ sort: e.target.value })} className={select} aria-label="Sort" data-testid="sort-select">
        {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      <div className="flex shrink-0 rounded-full border border-[#C2DEDA] bg-white p-1 md:ml-auto">
        {[["grid", LayoutGrid, "List"], ["map", MapIcon, "Map"]].map(([v, Icon, label]) => (
          <button key={v} onClick={() => setView(v)} data-testid={`view-${v}`} aria-label={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${view === v ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65]"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Deals() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") || "all";
  const suburb = params.get("suburb") || "";
  const sort = params.get("sort") || "recommended";
  const [q, setQ] = useState(params.get("q") || "");
  const [all, setAll] = useState(null);
  const [view, setView] = useState("grid");
  const [openOnly, setOpenOnly] = useState(false);
  const { me, state: locState, locate, clear } = useMyLocation();
  const wantNear = params.get("near") === "1";
  useEffect(() => { if (wantNear && locState === "idle") locate(); }, [wantNear]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get("/deals").then((r) => setAll(Array.isArray(r.data) ? r.data : [])).catch(() => setAll([]));
  }, []);

  const suburbs = useMemo(() => [...new Set((all || []).map((d) => d.suburb).filter(Boolean))].sort(), [all]);
  const base = useMemo(() => (all || []).filter((d) => (!suburb || d.suburb === suburb) && matches(d, q) && (!openOnly || d.open_now)), [all, suburb, q, openOnly]);
  const list = useMemo(() => {
    const inCat = base.filter((d) => category === "all" || d.category === category);
    return me ? sortNearby(inCat, me) : sortDeals(inCat, sort);
  }, [base, category, me, sort]);
  const browsing = category === "all" && !suburb && !q && !openOnly && sort === "recommended" && !me;

  const update = (patch) => {
    const next = { category, suburb, sort, ...patch };
    const clean = {};
    if (next.category && next.category !== "all") clean.category = next.category;
    if (next.suburb) clean.suburb = next.suburb;
    if (next.sort && next.sort !== "recommended") clean.sort = next.sort;
    setParams(clean);
  };
  const reset = () => { setQ(""); setOpenOnly(false); clear(); setParams({}); };
  const count = (k) => base.filter((d) => k === "all" || d.category === k).length;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-8 sm:px-8 lg:pt-12" data-testid="deals-directory">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Explore <Underline color="#4CC9F0">family deals</Underline></h1>
      <p className="mt-2 text-[#3D5E65]" data-testid="deals-count">{all ? `${list.length} deal${list.length === 1 ? "" : "s"}${category !== "all" ? " in this category" : ""}` : "Loading deals…"}</p>

      <label className="relative mt-6 block w-full max-w-xl">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#3D5E65]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals, places or suburbs" data-testid="deals-search-input"
          className="h-12 w-full rounded-full border-2 border-[#17434C] bg-white pl-12 pr-10 text-[15px] shadow-[3px_3px_0_#17434C] outline-none focus:border-[#B9512E]" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#3D5E65] hover:bg-[#EAF6F3]" data-testid="deals-search-clear"><X className="h-4 w-4" /></button>}
      </label>

      <div className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden" data-lenis-prevent data-testid="category-chips">
        {[{ key: "all", label: "All", tone: { bg: "#FFFFFF", fg: "#17434C", solid: "#17434C", on: "#EAF6F3" } }, ...CATEGORIES].map((c) => {
          const on = category === c.key;
          return (
            <button key={c.key} onClick={() => update({ category: c.key })} data-testid={`filter-${c.key}`} aria-pressed={on}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-bold transition-[transform,box-shadow] ${on ? "border-[#17434C] shadow-[3px_3px_0_#17434C]" : "border-transparent hover:-translate-y-0.5"}`}
              style={{ background: on ? c.tone.solid : c.tone.bg, color: on ? c.tone.on : c.tone.fg }}>
              {c.label} <span className="font-mono text-xs opacity-80">{all ? count(c.key) : ""}</span>
            </button>
          );
        })}
      </div>

      <Toolbar p={{ suburb, suburbs, update, locState, locate, clear, openOnly, setOpenOnly, sort, view, setView }} />
      {LOC_MSG[locState] && <p className="mt-3 text-sm text-[#9A4024]" data-testid="near-me-error">{LOC_MSG[locState]}</p>}
      {locState === "on" && <p className="mt-3 text-sm text-[#3D5E65]" data-testid="near-me-note">Showing places open now first, then the closest to you.</p>}

      {all === null ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-[#D3ECE7]" />)}</div>
      ) : view === "map" ? (
        <div className="mt-8"><DealsMap deals={list} /></div>
      ) : list.length === 0 ? (
        <div className="pop mt-12 rounded-3xl border-2 border-[#17434C] bg-[#FFF4CE] p-10 text-center" data-testid="deals-empty">
          <p className="font-display text-2xl font-semibold">No deals match that</p>
          <p className="mt-2 text-[#3D5E65]">Try another search or category.</p>
          <button onClick={reset} className="pop-sm pop-hover mt-5 rounded-full border-2 border-[#17434C] bg-[#4CC9F0] px-6 py-3 text-sm font-bold text-[#0F3138]" data-testid="deals-reset-btn">Show all deals</button>
        </div>
      ) : (
        <>
          {browsing && (
            <div className="mt-4">
              <DealRow id="new" title="New this week" icon={Sparkles} sub="Just added by local partners." deals={all.filter(isNew)} />
              <DealRow id="ending" title="Ending soon" icon={Timer} sub="Use them before they're gone." deals={sortDeals(all.filter(endsSoon), "ending")} />
            </div>
          )}
          {browsing && <h2 className="mt-6 font-display text-2xl font-semibold tracking-tight sm:text-3xl">All deals</h2>}
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="deals-grid">
            {list.map((d) => <DealCard key={d.id} deal={d} />)}
          </div>
        </>
      )}
    </div>
  );
}
