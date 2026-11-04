import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DealCard } from "@/components/DealCard";

/** Horizontally scrolling row of deal cards with arrow buttons on desktop and swipe on phones. */
export function DealRow({ id, title, icon: Icon, sub, deals, moreTo, moreLabel = "See all" }) {
  const ref = useRef(null);
  if (!Array.isArray(deals) || deals.length === 0) return null;
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section className="py-8" data-testid={`deal-row-${id}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {Icon && <Icon className="h-6 w-6 text-[#B9512E]" />}{title}
          </h2>
          {sub && <p className="mt-1 text-sm text-[#3D5E65]">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {moreTo && <Link to={moreTo} className="text-sm font-semibold text-[#9A4024] hover:underline" data-testid={`deal-row-${id}-more`}>{moreLabel}</Link>}
          <button onClick={() => scroll(-1)} aria-label="Scroll left" className="hidden h-9 w-9 place-items-center rounded-full border border-[#C2DEDA] bg-white transition-colors hover:border-[#17434C] md:grid"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => scroll(1)} aria-label="Scroll right" className="hidden h-9 w-9 place-items-center rounded-full border border-[#C2DEDA] bg-white transition-colors hover:border-[#17434C] md:grid"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={ref} className="-mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-lenis-prevent>
        {deals.map((d) => (
          <div key={d.id} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%] xl:w-[23.5%]"><DealCard deal={d} compact /></div>
        ))}
      </div>
    </section>
  );
}
