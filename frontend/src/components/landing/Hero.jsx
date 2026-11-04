import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { MaskLines } from "@/components/Reveal";
import { MemberCard } from "@/components/MemberCard";
import { api } from "@/lib/api";

const HERO_IMG = "https://images.unsplash.com/photo-1516213335993-159eca2981af?auto=format&fit=crop&w=1400&q=80";
const KIDS_IMG = "https://images.unsplash.com/photo-1593103916129-87e179a70c1f?auto=format&fit=crop&w=600&q=80";
const EASE = [0.16, 1, 0.3, 1];

function RotatingBadge() {
  return (
    <div className="spin-slow relative h-28 w-28 sm:h-32 sm:w-32" aria-hidden="true">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <defs><path id="circ" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" /></defs>
        <circle cx="50" cy="50" r="50" fill="#EE8A63" />
        <text className="font-mono" fontSize="9.5" fontWeight="700" letterSpacing="2.4" fill="#17434C">
          <textPath href="#circ">ONE DAY OUT · PAYS FOR ITSELF ·</textPath>
        </text>
        <path fill="#B9512E" d="M50 36l3.4 10.6L64 50l-10.6 3.4L50 64l-3.4-10.6L36 50l10.6-3.4z" />
      </svg>
    </div>
  );
}

export function Hero() {
  const ref = useRef(null);
  const [stats, setStats] = useState(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const cardY = useTransform(scrollYProgress, [0, 1], [0, -120]);

  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => setStats(null));
  }, []);

  return (
    <section ref={ref} className="grain relative overflow-hidden" data-testid="hero-section">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:pb-28 lg:pt-20">
        <div className="relative z-10 lg:col-span-7">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-[#17434C]/15 bg-white/60 px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[#17434C]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4E7A58]" />
            A little local club, for everyone
          </motion.p>
          <MaskLines
            testId="hero-title"
            className="mt-8 font-display text-[3.4rem] font-semibold leading-[0.92] tracking-[-0.03em] text-[#17434C] sm:text-7xl lg:text-[6.6rem]"
            lines={[
              <>Eat, play</>,
              <><em className="font-normal italic text-[#B9512E]">&amp; shop</em> for</>,
              <>less<span className="text-[#EE8A63]">.</span></>,
            ]}
          />
          <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.9, ease: EASE }}
            className="mt-8 max-w-xl text-base leading-relaxed text-[#3D5E65] md:text-lg">
            One yearly membership unlocks exclusive deals at cafes, kids activities, restaurants and days out around you. Show your phone, save on the spot.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.9, ease: EASE }}
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/join" data-testid="hero-join-btn"
              className="group inline-flex items-center justify-center gap-3 rounded-full bg-[#17434C] py-4 pl-7 pr-4 text-[15px] font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#B9512E] active:scale-95">
              Join the club — $49/yr
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EAF6F3] text-[#17434C] transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
            <Link to="/deals" data-testid="hero-browse-btn" className="inline-flex items-center justify-center rounded-full border border-[#17434C]/20 px-7 py-4 text-[15px] font-semibold transition-colors hover:border-[#17434C]">
              Browse the deals
            </Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 1 }}
            className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-[#17434C]/15 pt-6" data-testid="hero-stats">
            <div><dt className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">Live offers</dt><dd className="mt-1 font-display text-3xl font-semibold" data-testid="hero-stat-deals">{stats?.live_deals ?? "—"}</dd></div>
            <div><dt className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">Suburbs</dt><dd className="mt-1 font-display text-3xl font-semibold">{stats?.suburbs ?? "—"}</dd></div>
            <div><dt className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">Per year</dt><dd className="mt-1 font-display text-3xl font-semibold">$49</dd></div>
          </motion.dl>
        </div>

        <div className="relative lg:col-span-5">
          <motion.div initial={{ clipPath: "inset(100% 0 0 0 round 999px 999px 32px 32px)" }} animate={{ clipPath: "inset(0% 0 0 0 round 999px 999px 32px 32px)" }}
            transition={{ duration: 1.4, ease: EASE, delay: 0.2 }}
            className="relative mx-auto aspect-[4/5] w-full max-w-[460px] overflow-hidden bg-[#D3ECE7]">
            <motion.img style={{ y: imgY, scale: 1.18 }} src={HERO_IMG} alt="Brunch spread at a local cafe" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,transparent_40%,rgba(18,22,26,0.35))]" />
          </motion.div>
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 1.1, type: "spring", stiffness: 120, damping: 14 }}
            className="absolute -left-2 top-4 sm:left-2 lg:-left-10">
            <RotatingBadge />
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.3, duration: 0.8, ease: EASE }}
            className="absolute -right-1 top-1/3 h-24 w-24 overflow-hidden rounded-full border-4 border-[#EAF6F3] shadow-xl sm:h-28 sm:w-28 lg:-right-6">
            <img src={KIDS_IMG} alt="Child playing outdoors" className="h-full w-full object-cover" />
          </motion.div>
          <motion.div style={{ y: cardY }} className="relative z-10 mx-auto -mt-28 w-[88%] max-w-[400px] sm:-mt-36">
            <motion.div initial={{ opacity: 0, y: 80, rotate: 8 }} animate={{ opacity: 1, y: 0, rotate: -4 }} transition={{ delay: 0.9, duration: 1.2, ease: EASE }}>
              <MemberCard name="Alex Morgan" code="GP-8K2Q4M" expires="Nov 2027" status="active" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
