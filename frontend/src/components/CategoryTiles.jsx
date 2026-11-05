import { Link } from "react-router-dom";
import { CATEGORIES } from "@/lib/api";

/** Photo tiles for each category with a live count of deals. */
export function CategoryTiles({ deals }) {
  const list = Array.isArray(deals) ? deals : [];
  const count = (k) => list.filter((d) => d.category === k).length;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6" data-testid="category-tiles">
      {CATEGORIES.map((c) => {
        const n = count(c.key);
        return (
          <Link key={c.key} to={`/deals?category=${c.key}`} data-testid={`category-tile-${c.key}`}
            className="pop pop-hover group relative flex aspect-[4/5] flex-col overflow-hidden rounded-3xl border-[3px] border-[#17434C] sm:aspect-[3/4]" style={{ background: c.tone.solid }}>
            <div className="relative min-h-0 flex-1 overflow-hidden"><img src={c.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" /></div>
            <div className="shrink-0 border-t-[3px] border-[#17434C] p-3 sm:p-4" style={{ background: c.tone.bg }}>
              <p className="font-display text-base font-semibold leading-tight sm:text-lg" style={{ color: c.tone.fg }}>{c.label}</p>
              <p className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: c.tone.solid, color: c.tone.on }} data-testid={`category-count-${c.key}`}>{n ? `${n} deal${n === 1 ? "" : "s"}` : "Coming soon"}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
