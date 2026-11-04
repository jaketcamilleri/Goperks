import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, ArrowUpRight } from "lucide-react";
import { catLabel } from "@/lib/api";

export function DealCard({ deal, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.08 }}
    >
      <Link to={`/deals/${deal.id}`} className="group block" data-testid={`deal-card-${deal.id}`}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#F3EDE2]">
          <img
            src={deal.image_url}
            alt={deal.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#12161A]/50 via-transparent to-transparent" />
          <span className="absolute left-4 top-4 rotate-[-4deg] rounded-full bg-[#F3A72E] px-4 py-1.5 font-display text-lg font-semibold text-[#1E2229] shadow-lg transition-transform duration-500 group-hover:rotate-0">
            {deal.discount_label}
          </span>
          <span className="absolute bottom-4 right-4 grid h-11 w-11 translate-y-2 place-items-center rounded-full bg-[#FBF8F3] text-[#1E2229] opacity-0 transition-[opacity,transform] duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        </div>
        <div className="px-1 pt-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#B63F18]">{catLabel(deal.category)}</p>
          <h3 className="mt-2 font-display text-xl font-semibold leading-snug text-[#1E2229] transition-colors group-hover:text-[#B63F18] sm:text-2xl">
            {deal.title}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-[#525B68]">
            <span className="font-semibold text-[#1E2229]">{deal.business_name}</span>
            <span aria-hidden="true">·</span>
            <MapPin className="h-3.5 w-3.5" />
            {deal.suburb}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
