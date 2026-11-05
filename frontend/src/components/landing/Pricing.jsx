import { Link } from "react-router-dom";
import { Check, Gift } from "lucide-react";
import { Confetti } from "@/components/Fun";

const PRICE_CONFETTI = [["star", "#FFD166", "left-[6%] top-10 h-8 w-8", 10], ["dot", "#FF70A6", "left-[40%] bottom-12 h-4 w-4"], ["squiggle", "#4CC9F0", "left-[8%] bottom-16 h-5 w-20", 6], ["star", "#70E000", "right-[4%] top-8 h-6 w-6", -12]];

export const PERKS = [
  "Every deal in the club, all year",
  "Digital member card on your phone",
  "Unique voucher codes for one-off offers",
  "Covers your whole household",
  "New local deals added every month",
];

export function PricingTicket({ cta, price }) {
  return (
    <div
      className="ticket-edge relative overflow-hidden rounded-[28px] bg-[#EAF6F3] text-[#17434C] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]" data-testid="pricing-ticket">
      <div className="p-8 sm:p-10">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#9A4024]">Annual membership</span>
          <span className="rounded-full bg-[#EBF3EC] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#2F5A3A]">No lock-in</span>
        </div>
        <p className="mt-6 flex flex-wrap items-end gap-x-2">
          {price && price !== 49 && <span className="pb-2 font-display text-2xl text-[#3D5E65] line-through" data-testid="pricing-full-amount">$49</span>}
          <span className="font-display text-7xl font-semibold leading-none sm:text-8xl" data-testid="pricing-amount">${price && price !== 49 ? price.toFixed(2) : 49}</span>
          <span className="pb-2 text-[#3D5E65]">AUD / {price && price !== 49 ? "first year" : "year"}</span>
        </p>
        <p className="mt-2 text-sm text-[#3D5E65]">That's less than a dollar a week.</p>
        {price === 24.5 ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#FDF0EC] px-3 py-2.5 text-sm font-semibold text-[#9A4024]" data-testid="pricing-launch-line">
            <Gift className="mt-0.5 h-4 w-4 shrink-0" /> Launch week offer: half price for your first year. Then $49 a year.
          </p>
        ) : (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-[#FDF0EC] px-3 py-2.5 text-sm font-semibold text-[#9A4024]" data-testid="pricing-referral-line">
            <Gift className="mt-0.5 h-4 w-4 shrink-0" /> Invited by a friend? Your first year is $44.92 (one month free), and they get a free month at their next renewal.
          </p>
        )}
      </div>
      <div className="mx-8 border-t-2 border-dashed border-[#C2DEDA] sm:mx-10" />
      <div className="p-8 sm:p-10">
        <ul className="space-y-3">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#17434C]" style={{ background: ["#FFD166", "#4CC9F0", "#FF70A6", "#70E000", "#FF8531"][PERKS.indexOf(p) % 5] }}><Check className="h-3 w-3" /></span>
              {p}
            </li>
          ))}
        </ul>
        {cta}
      </div>
    </div>
  );
}

export function Pricing({ price }) {
  return (
    <section className="relative overflow-hidden bg-[#17434C] text-[#EAF6F3]" data-testid="pricing-section">
      <Confetti items={PRICE_CONFETTI} />
      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#FFD166]">One price. The whole family.</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            One family day out can <span className="text-[#FFD166]">pay for the year.</span>
          </h2>
          <p className="mt-5 max-w-md text-[#C2DEDA] md:text-lg">A free kids meal here, 2-for-1 entry at the play centre there, half price at your favourite local. It adds up fast, and your savings tracker shows exactly how much.</p>
        </div>
        <div className="lg:col-span-5 lg:col-start-8">
          <PricingTicket cta={
            <Link to="/join" data-testid="pricing-join-btn" className="pop pop-hover mt-8 block rounded-full border-2 border-[#17434C] bg-[#B9512E] py-4 text-center font-bold text-white hover:bg-[#9A4024]">
              Become a member
            </Link>
          } price={price} />
        </div>
      </div>
    </section>
  );
}
