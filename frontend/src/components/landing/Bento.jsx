import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { CATEGORIES } from "@/lib/api";
import { Eyebrow, FadeUp } from "@/components/Reveal";

const SPANS = [
  "md:col-span-7 md:row-span-2",
  "md:col-span-5",
  "md:col-span-5",
  "md:col-span-4",
  "md:col-span-4",
  "md:col-span-4",
];
const BLURBS = ["Flat whites, sourdough and slow Sunday brunches.", "Play centres, swim lessons, holiday programs.", "Pizza nights and family feasts.", "Museums, farms and big days out.", "Groceries and the weekly shop.", "Cabins, coast and long weekends."];

export function Bento() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32" data-testid="category-bento">
      <div className="grid gap-6 md:grid-cols-12 md:items-end">
        <FadeUp className="md:col-span-7">
          <Eyebrow>Browse by category</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            Every kind of <em className="font-normal italic text-[#B9512E]">local outing</em>, covered.
          </h2>
        </FadeUp>
        <FadeUp delay={0.1} className="md:col-span-4 md:col-start-9">
          <p className="text-base text-[#3D5E65] md:text-lg">Pick a category and see what’s near you. New partners join the club every month.</p>
        </FadeUp>
      </div>
      <div className="mt-14 grid auto-rows-[240px] grid-cols-1 gap-4 md:grid-cols-12 md:auto-rows-[230px] lg:gap-5">
        {CATEGORIES.map((c, i) => (
          <motion.div key={c.key} className={SPANS[i]}
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: (i % 3) * 0.08 }}>
            <Link to={`/deals?category=${c.key}`} data-testid={`bento-${c.key}`}
              className="group relative block h-full overflow-hidden rounded-[28px] bg-[#17434C]">
              <img src={c.img} alt={c.label} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition-[transform,opacity] duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-105 group-hover:opacity-60" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F3138]/85 via-[#0F3138]/20 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-6 text-[#EAF6F3] sm:p-7">
                <span className="self-start rounded-full bg-[#EAF6F3]/15 px-3 py-1 font-mono text-[11px] uppercase tracking-widest backdrop-blur-md">0{i + 1}</span>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className={`font-display font-semibold leading-none ${i === 0 ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"}`}>{c.label}</h3>
                    <p className="mt-2 max-w-xs text-sm text-[#C2DEDA]">{BLURBS[i]}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EAF6F3] text-[#17434C] transition-transform duration-500 group-hover:rotate-45">
                    <ArrowUpRight className="h-5 w-5" />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
