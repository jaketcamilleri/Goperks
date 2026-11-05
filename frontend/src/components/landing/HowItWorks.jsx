import { Search, Smartphone, PiggyBank } from "lucide-react";

const STEPS = [
  { icon: Search, t: "Find a deal", d: "Browse cafes, kids activities, restaurants and days out near you, or tap Near me.", c: "#FFD166", bg: "#FFF4CE" },
  { icon: Smartphone, t: "Show your live card", d: "Open Go Perks at the counter. Staff scan your live card or a one-off voucher code.", c: "#4CC9F0", bg: "#E2F9FE" },
  { icon: PiggyBank, t: "Save on the spot", d: "The saving comes off straight away, and your savings tracker keeps the tally all year.", c: "#FF70A6", bg: "#FFE3EC" },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-white" data-testid="how-it-works">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:items-center lg:py-24">
        <div className="lg:col-span-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">How it works</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">Three steps, no paper vouchers.</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, t, d, c, bg }, i) => (
            <li key={t} className="pop rounded-3xl border-2 border-[#17434C] p-6" style={{ background: bg }} data-testid={`how-step-${i + 1}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#17434C] text-[#17434C]" style={{ background: c }}><Icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs font-bold text-[#17434C]">STEP {i + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-[#3D5E65]">{d}</p>
            </li>
          ))}
        </ol>
        </div>
        <div className="relative mx-auto w-full max-w-sm lg:col-span-4" data-testid="how-photo">
          <div className="pop aspect-[4/5] overflow-hidden rounded-[36px] border-[3px] border-[#17434C] bg-[#70E000]">
            <img src="/images/family/family-picnic.jpg" alt="Parents and their baby enjoying a picnic" loading="lazy" className="h-full w-full object-cover" />
          </div>
          <span className="pop-sm absolute -bottom-4 left-4 -rotate-3 rounded-2xl border-2 border-[#17434C] bg-[#FFD166] px-4 py-2 text-sm font-bold text-[#17434C]">One card covers the whole household</span>
        </div>
      </div>
    </section>
  );
}
