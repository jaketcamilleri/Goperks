import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PartyPopper, ArrowRight } from "lucide-react";
import { endsLabel } from "@/lib/launch";

/** Home-page launch announcement. Renders nothing unless the admin-set launch week is live. */
export function LaunchBanner({ offer }) {
  if (!offer?.active) return null;
  return (
    <section className="relative overflow-hidden bg-[#B9512E] text-[#FFF6F1]" data-testid="launch-banner">
      <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[18px] border-[#EE8A63]/40" />
      <motion.div initial={{ opacity: 0.4, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="relative mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#FFF6F1] text-[#B9512E]"><PartyPopper className="h-5 w-5" /></span>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#FFD9C9]" data-testid="launch-banner-eyebrow">Go Perks is live</p>
            <p className="mt-1 font-display text-2xl font-semibold leading-tight sm:text-3xl" data-testid="launch-banner-title">
              Launch week: your first year is <span className="whitespace-nowrap">half price</span>
            </p>
            <p className="mt-1 text-sm text-[#FFE7DD]" data-testid="launch-banner-terms">
              Join for <b>$24.50</b> instead of <span className="line-through">$49</span>. New members only, ends {endsLabel(offer.ends_on)}.
            </p>
          </div>
        </div>
        <Link to="/join" data-testid="launch-banner-join-btn"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#17434C] px-6 py-3.5 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#0F3138] active:scale-[0.98]">
          Claim half price <ArrowRight className="h-4 w-4" />
        </Link>
      </motion.div>
    </section>
  );
}
