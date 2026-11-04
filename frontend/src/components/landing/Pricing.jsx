import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Eyebrow, FadeUp } from "@/components/Reveal";

export const PERKS = [
  "Every deal in the club, all year",
  "Digital member card on your phone",
  "Unique voucher codes for one-off offers",
  "Covers your whole household",
  "New local deals added every month",
];

export function PricingTicket({ cta }) {
  return (
    <motion.div whileHover={{ rotate: -1, y: -6 }} transition={{ type: "spring", stiffness: 200, damping: 16 }}
      className="ticket-edge relative overflow-hidden rounded-[32px] bg-[#FBF8F3] text-[#1E2229] shadow-[0_50px_100px_-40px_rgba(0,0,0,0.6)]" data-testid="pricing-ticket">
      <div className="p-8 sm:p-10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#B63F18]">Annual membership</span>
          <span className="rounded-full bg-[#EBF3EC] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#2F5A3A]">No lock-in</span>
        </div>
        <p className="mt-6 flex items-end gap-2">
          <span className="font-display text-7xl font-semibold leading-none sm:text-8xl" data-testid="pricing-amount">$49</span>
          <span className="pb-2 text-[#525B68]">AUD / year</span>
        </p>
        <p className="mt-2 text-sm text-[#525B68]">That's less than a dollar a week.</p>
      </div>
      <div className="mx-8 border-t-2 border-dashed border-[#E0D7C3] sm:mx-10" />
      <div className="p-8 sm:p-10">
        <ul className="space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#D95329] text-[#FBF8F3]"><Check className="h-3 w-3" /></span>
              {p}
            </li>
          ))}
        </ul>
        {cta}
      </div>
    </motion.div>
  );
}

export function Pricing() {
  return (
    <section className="relative overflow-hidden bg-[#D95329] text-[#FBF8F3]" data-testid="pricing-section">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-32">
        <div className="lg:col-span-6">
          <Eyebrow className="!text-[#FBF8F3]">One price. Every deal.</Eyebrow>
          <FadeUp>
            <h2 className="mt-5 font-display text-5xl font-semibold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">
              One day out <em className="font-normal italic text-[#1E2229]">pays for itself.</em>
            </h2>
          </FadeUp>
          <p className="mt-6 max-w-md text-[#FDF0EC] md:text-lg">Half price at your favourite local, a free kids meal here, 2-for-1 coffees there. It adds up fast.</p>
        </div>
        <FadeUp delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <PricingTicket cta={
            <Link to="/join" data-testid="pricing-join-btn" className="mt-8 block rounded-full bg-[#1E2229] py-4 text-center font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#D95329] active:scale-[0.98]">
              Become a member
            </Link>
          } />
        </FadeUp>
      </div>
    </section>
  );
}
