import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search, ShieldCheck, Smartphone, Baby } from "lucide-react";
import { MemberCard } from "@/components/MemberCard";
import { Confetti, Underline } from "@/components/Fun";

const EASE = [0.16, 1, 0.3, 1];
const fade = (delay) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay } });

function HeroSearch() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const go = (e) => { e.preventDefault(); nav(q.trim() ? `/deals?q=${encodeURIComponent(q.trim())}` : "/deals"); };
  return (
    <form onSubmit={go} className="pop mt-8 flex w-full max-w-xl items-center gap-2 rounded-full border-2 border-[#17434C] bg-white p-1.5" data-testid="hero-search-form">
      <Search className="ml-3 h-5 w-5 shrink-0 text-[#3D5E65]" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “coffee”, “pancakes” or a suburb" aria-label="Search deals"
        className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#5E7F84]" data-testid="hero-search-input" />
      <button className="h-11 shrink-0 rounded-full bg-[#17434C] px-5 text-sm font-semibold text-[#EAF6F3] transition-colors hover:bg-[#0F3138]" data-testid="hero-search-btn">Search</button>
    </form>
  );
}

const TRUST = [
  [Smartphone, "Live card on your phone", "#4CC9F0"],
  [Baby, "Covers the whole family", "#FFD166"],
  [ShieldCheck, "Every deal checked by us", "#70E000"],
];

const HERO_CONFETTI = [
  ["star", "#FFD166", "left-[4%] top-10 h-7 w-7", 12], ["dot", "#FF70A6", "left-[46%] top-6 h-3 w-3"],
  ["squiggle", "#4CC9F0", "right-[8%] bottom-10 h-5 w-16", -8], ["star", "#7054CB", "left-[52%] bottom-16 h-5 w-5", -10],
  ["dot", "#70E000", "left-[2%] bottom-24 h-4 w-4"],
];

function HeroPhotos() {
  return (
    <div className="relative mx-auto w-full max-w-[560px] sm:pb-28" data-testid="hero-photos">
      <div className="pop relative aspect-[4/3] overflow-hidden rounded-[40px] border-[3px] border-[#17434C] bg-[#FFD166]">
        <img src="/images/family/kids-parachute.jpg" alt="Kids playing with a rainbow parachute in the park" className="h-full w-full object-cover" data-testid="hero-photo-main" />
      </div>
      <div className="pop-sm absolute -left-3 -top-6 hidden aspect-square w-28 overflow-hidden rounded-full border-[3px] border-[#17434C] bg-[#FF70A6] sm:block lg:-left-10 lg:w-32" style={{ transform: "rotate(-6deg)" }}>
        <img src="/images/family/family-picnic.jpg" alt="A family having a picnic" className="h-full w-full object-cover" />
      </div>
      <span className="pop-sm absolute -top-4 right-4 rotate-6 rounded-full border-2 border-[#17434C] bg-[#70E000] px-4 py-1.5 text-sm font-bold text-[#0F3138]" data-testid="hero-kids-sticker">Kids love it!</span>
      <div className="relative -mt-14 ml-auto w-[86%] max-w-[320px] sm:absolute sm:-bottom-2 sm:-right-4 sm:mt-0 sm:w-[62%] sm:max-w-[300px]" style={{ transform: "rotate(-4deg)" }} data-testid="hero-member-card">
        <MemberCard name="The Morgans" code="GP-8K2Q4M" expires="Nov 2027" status="active" />
      </div>
    </div>
  );
}

export function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden" data-testid="hero-section">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#FFE3EC]" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-32 bottom-8 h-[300px] w-[300px] rounded-full bg-[#E2F9FE]" aria-hidden="true" />
      <Confetti items={HERO_CONFETTI} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-12 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-6">
          <motion.p {...fade(0)} className="inline-flex items-center gap-2 rounded-full border-2 border-[#17434C] bg-[#FFD166] px-3 py-1.5 text-xs font-bold text-[#17434C]">
            <span className="h-2 w-2 rounded-full bg-[#B9512E]" /> {stats?.live_deals ? `${stats.live_deals} family deals` : "The family deals club"}{stats?.suburbs ? ` across ${stats.suburbs} suburbs` : ""}
          </motion.p>
          <motion.h1 {...fade(0.05)} className="mt-5 font-display text-4xl font-semibold leading-[1.08] tracking-tight text-[#17434C] sm:text-5xl lg:text-6xl" data-testid="hero-title">
            More family fun, <span className="text-[#B9512E]"><Underline>for less.</Underline></span>
          </motion.h1>
          <motion.p {...fade(0.1)} className="mt-5 max-w-xl text-base leading-relaxed text-[#3D5E65] md:text-lg">
            One A$49 yearly membership unlocks deals for the whole family at local cafes, kids activities, restaurants and days out. Show your live card at the counter and save on the spot.
          </motion.p>
          <motion.div {...fade(0.15)}><HeroSearch /></motion.div>
          <motion.div {...fade(0.2)} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/join" data-testid="hero-join-btn" className="pop pop-hover group inline-flex items-center justify-center gap-2 rounded-full border-2 border-[#17434C] bg-[#B9512E] px-7 py-3.5 font-bold text-white hover:bg-[#9A4024]">
              Join for A$49/year <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/deals" data-testid="hero-browse-btn" className="pop pop-hover inline-flex items-center justify-center rounded-full border-2 border-[#17434C] bg-[#4CC9F0] px-7 py-3.5 font-bold text-[#0F3138]">Browse deals</Link>
          </motion.div>
          <ul className="mt-8 grid gap-3 text-sm font-semibold text-[#17434C] sm:grid-cols-3" data-testid="hero-trust">
            {TRUST.map(([Icon, t, c]) => <li key={t} className="flex items-center gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-[#17434C]" style={{ background: c }}><Icon className="h-3.5 w-3.5" /></span>{t}</li>)}
          </ul>
        </div>
        <motion.div initial={{ opacity: 0.3, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="w-full lg:col-span-6">
          <HeroPhotos />
        </motion.div>
      </div>
    </section>
  );
}
