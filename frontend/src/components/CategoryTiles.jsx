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
            className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-[#17434C] sm:aspect-[3/4]">
            <img src={c.img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F3138]/90 via-[#0F3138]/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
              <p className="font-display text-lg font-semibold leading-tight text-white sm:text-xl">{c.label}</p>
              <p className="mt-1 text-xs font-semibold text-[#D3ECE7]" data-testid={`category-count-${c.key}`}>{n ? `${n} deal${n === 1 ? "" : "s"}` : "Coming soon"}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
