import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Timer, Award } from "lucide-react";
import { api } from "@/lib/api";
import { isNew, endsSoon, sortDeals } from "@/lib/deals";
import { Hero } from "@/components/landing/Hero";
import { CategoryTiles } from "@/components/CategoryTiles";
import { DealRow } from "@/components/DealRow";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { ReferFriend } from "@/components/landing/ReferFriend";
import { MemberVoices, Faq } from "@/components/landing/MemberVoices";
import { BusinessCta } from "@/components/landing/BusinessCta";

function Rows({ deals }) {
  const fresh = deals.filter(isNew);
  const ending = sortDeals(deals.filter(endsSoon), "ending");
  const rated = sortDeals(deals.filter((d) => d.rating_count > 0), "rating");
  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8" data-testid="landing-rows">
      <DealRow id="new" title={fresh.length ? "New this week" : "Fresh picks"} icon={Sparkles} sub={fresh.length ? "Just added by local partners." : "A taste of what's inside."}
        deals={(fresh.length ? fresh : deals).slice(0, 10)} moreTo="/deals?sort=newest" />
      <DealRow id="ending" title="Ending soon" icon={Timer} sub="Use them before they're gone." deals={ending.slice(0, 10)} moreTo="/deals?sort=ending" />
      <DealRow id="rated" title="Top rated by members" icon={Award} deals={rated.slice(0, 10)} moreTo="/deals?sort=rating" />
    </div>
  );
}

export default function Landing() {
  const [deals, setDeals] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/deals").then((r) => setDeals(Array.isArray(r.data) ? r.data : [])).catch(() => setDeals([]));
    api.get("/stats").then((r) => setStats(r.data || null)).catch(() => setStats(null));
  }, []);

  return (
    <div data-testid="landing-page">
      <Hero stats={stats} />
      <section className="mx-auto max-w-7xl px-5 pb-6 sm:px-8" data-testid="landing-categories">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Browse by category</h2>
          <Link to="/deals" className="text-sm font-semibold text-[#9A4024] hover:underline" data-testid="landing-all-deals-link">All deals</Link>
        </div>
        <div className="mt-5"><CategoryTiles deals={deals} /></div>
      </section>
      {deals && deals.length > 0 && <Rows deals={deals} />}
      <div className="mt-10"><HowItWorks /></div>
      <Pricing />
      <ReferFriend />
      <MemberVoices />
      <Faq />
      <BusinessCta />
    </div>
  );
}
