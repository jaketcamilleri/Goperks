import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Search, ShieldCheck, Smartphone, Ticket } from "lucide-react";
import { MemberCard } from "@/components/MemberCard";

const EASE = [0.16, 1, 0.3, 1];
const fade = (delay) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, ease: EASE, delay } });

function HeroSearch() {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const go = (e) => { e.preventDefault(); nav(q.trim() ? `/deals?q=${encodeURIComponent(q.trim())}` : "/deals"); };
  return (
    <form onSubmit={go} className="mt-8 flex w-full max-w-xl items-center gap-2 rounded-full border border-[#C2DEDA] bg-white p-1.5 shadow-[0_10px_30px_-15px_rgba(23,67,76,0.35)]" data-testid="hero-search-form">
      <Search className="ml-3 h-5 w-5 shrink-0 text-[#3D5E65]" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “coffee”, “pancakes” or a suburb" aria-label="Search deals"
        className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#5E7F84]" data-testid="hero-search-input" />
      <button className="h-11 shrink-0 rounded-full bg-[#17434C] px-5 text-sm font-semibold text-[#EAF6F3] transition-colors hover:bg-[#0F3138]" data-testid="hero-search-btn">Search</button>
    </form>
  );
}

const TRUST = [
  [Smartphone, "Live card on your phone"],
  [Ticket, "One yearly price, every deal"],
  [ShieldCheck, "Every deal checked by us"],
];

export function Hero({ stats }) {
  return (
    <section className="relative overflow-hidden" data-testid="hero-section">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#D3ECE7]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-12 lg:pb-24 lg:pt-16">
        <div className="lg:col-span-7">
          <motion.p {...fade(0)} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#17434C] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[#4E7A58]" /> {stats?.live_deals ? `${stats.live_deals} live deals` : "Local deals club"}{stats?.suburbs ? ` across ${stats.suburbs} suburbs` : ""}
          </motion.p>
          <motion.h1 {...fade(0.05)} className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[#17434C] sm:text-5xl lg:text-6xl" data-testid="hero-title">
            Save at the local places <span className="text-[#B9512E]">you already love.</span>
          </motion.h1>
          <motion.p {...fade(0.1)} className="mt-5 max-w-xl text-base leading-relaxed text-[#3D5E65] md:text-lg">
            One A$49 yearly membership unlocks member deals at cafes, kids activities, restaurants and days out. Show your live card at the counter and save on the spot.
          </motion.p>
          <motion.div {...fade(0.15)}><HeroSearch /></motion.div>
          <motion.div {...fade(0.2)} className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link to="/join" data-testid="hero-join-btn" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#B9512E] px-7 py-3.5 font-semibold text-white transition-[background-color,transform] hover:bg-[#9A4024] active:scale-95">
              Join for A$49/year <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/deals" data-testid="hero-browse-btn" className="inline-flex items-center justify-center rounded-full border border-[#17434C]/25 bg-white/60 px-7 py-3.5 font-semibold transition-colors hover:border-[#17434C]">Browse deals</Link>
          </motion.div>
          <ul className="mt-8 grid gap-3 text-sm text-[#17434C] sm:grid-cols-3" data-testid="hero-trust">
            {TRUST.map(([Icon, t]) => <li key={t} className="flex items-center gap-2"><Icon className="h-4 w-4 shrink-0 text-[#4E7A58]" />{t}</li>)}
          </ul>
        </div>
        <motion.div initial={{ opacity: 0, y: 30, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: -3 }} transition={{ duration: 0.9, ease: EASE, delay: 0.15 }}
          className="mx-auto w-full max-w-[420px] lg:col-span-5">
          <MemberCard name="Alex Morgan" code="GP-8K2Q4M" expires="Nov 2027" status="active" />
          <p className="mt-4 text-center text-sm text-[#3D5E65]">Your card lives on your phone. Partners scan it at the counter.</p>
        </motion.div>
      </div>
    </section>
  );
}
