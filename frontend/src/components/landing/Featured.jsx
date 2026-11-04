import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { DealCard } from "@/components/DealCard";
import { Eyebrow, FadeUp } from "@/components/Reveal";

export function Featured() {
  const [deals, setDeals] = useState([]);
  useEffect(() => {
    api.get("/deals").then((r) => setDeals(Array.isArray(r.data) ? r.data.slice(0, 3) : [])).catch(() => setDeals([]));
  }, []);
  if (!deals.length) return null;

  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32" data-testid="featured-deals">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <FadeUp>
          <Eyebrow>This month</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            A taste of <em className="font-normal italic text-[#B9512E]">what's inside</em>.
          </h2>
        </FadeUp>
        <Link to="/deals" data-testid="featured-all-link" className="group inline-flex items-center gap-2 font-semibold">
          Browse all deals <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {deals.map((d, i) => <DealCard key={d.id} deal={d} index={i} />)}
      </div>
    </section>
  );
}
