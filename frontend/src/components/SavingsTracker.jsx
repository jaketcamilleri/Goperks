import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

export function SavingsTracker({ refreshKey = 0 }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/me/savings").then((r) => setS(r.data || null)).catch(() => setS(null));
  }, [refreshKey]);

  const total = s?.total_saved ?? 0;
  const price = s?.membership_price ?? 49;
  const pct = Math.min(100, Math.round((total / price) * 100));
  const paidOff = total >= price;

  return (
    <div className="rounded-[28px] bg-[#F3A72E] p-6 text-[#1E2229] sm:p-8" data-testid="savings-tracker">
      <p className="font-mono text-xs uppercase tracking-[0.2em]">Savings this membership</p>
      <p className="mt-3 font-display text-6xl font-semibold leading-none sm:text-7xl" data-testid="savings-total">
        ${total.toFixed(total % 1 ? 2 : 0)}
      </p>
      <p className="mt-2 text-sm font-medium" data-testid="savings-message">
        {paidOff ? `Your membership has paid for itself — you're $${(total - price).toFixed(0)} ahead!` : `$${(price - total).toFixed(0)} to go until your $${price} membership pays for itself.`}
      </p>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#1E2229]/15">
        <motion.div className="h-full rounded-full bg-[#1E2229]" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] uppercase tracking-widest">
        <span>{s?.redeemed_count ?? 0} deals used</span><span>{pct}% of ${price}</span>
      </div>
    </div>
  );
}
