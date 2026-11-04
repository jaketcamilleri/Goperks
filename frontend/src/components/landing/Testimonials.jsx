import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Eyebrow, FadeUp } from "@/components/Reveal";

const QUOTES = [
  { q: "We've saved so much on weekend outings already. The kids pick a deal, we show the card, everyone's happy.", n: "Mel", s: "Newtown" },
  { q: "Half price at our favourite local restaurant, and it more than covered the yearly membership in the first month.", n: "Priya", s: "Brunswick" },
  { q: "Love how easy it is. No clunky vouchers, just our phones at the counter. We've discovered so many new places nearby.", n: "Josh & Amy", s: "Fitzroy" },
];
const SHOP_IMG = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80";

export function Testimonials() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32" data-testid="testimonials">
      <Eyebrow>Real members, real savings</Eyebrow>
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {QUOTES.map((t, i) => (
          <motion.figure key={t.n} data-testid={`testimonial-${i}`}
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col justify-between rounded-[28px] border border-[#E0D7C3] p-8 ${i === 1 ? "bg-[#1E2229] text-[#FBF8F3] lg:-translate-y-6" : "bg-white"}`}>
            <blockquote className="font-display text-xl leading-snug sm:text-2xl">“{t.q}”</blockquote>
            <figcaption className="mt-10 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F3A72E] font-display font-semibold text-[#1E2229]">{t.n[0]}</span>
              <span><span className="block font-semibold">{t.n}</span><span className={`text-sm ${i === 1 ? "text-[#C9CED6]" : "text-[#525B68]"}`}>{t.s}</span></span>
            </figcaption>
          </motion.figure>
        ))}
      </div>
    </section>
  );
}

export function BusinessCta() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:pb-32" data-testid="business-cta">
      <div className="grid overflow-hidden rounded-[36px] bg-[#F3EDE2] md:grid-cols-2">
        <div className="relative min-h-[280px] overflow-hidden">
          <motion.img initial={{ scale: 1.2 }} whileInView={{ scale: 1 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            src={SHOP_IMG} alt="Local boutique storefront" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <FadeUp className="p-8 sm:p-12 lg:p-16">
          <Eyebrow>For local businesses</Eyebrow>
          <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl">Run a family business? <em className="font-normal italic text-[#D95329]">Share a deal.</em></h2>
          <p className="mt-5 text-[#525B68] md:text-lg">Put your cafe, play centre or shop in front of local families. Submit your offer — we review it and put it live for members.</p>
          <Link to="/business" data-testid="business-cta-btn" className="mt-8 inline-flex rounded-full bg-[#1E2229] px-7 py-4 font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#D95329] active:scale-95">
            List your deal
          </Link>
        </FadeUp>
      </div>
    </section>
  );
}
