import { Search, Smartphone, PiggyBank } from "lucide-react";

const STEPS = [
  { icon: Search, t: "Find a deal", d: "Browse cafes, kids activities, restaurants and days out near you, or tap Near me." },
  { icon: Smartphone, t: "Show your live card", d: "Open Go Perks at the counter. Staff scan your live card or a one-off voucher code." },
  { icon: PiggyBank, t: "Save on the spot", d: "The saving comes off straight away, and your savings tracker keeps the tally all year." },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-white" data-testid="how-it-works">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">How it works</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">Three steps, no paper vouchers.</h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, t, d }, i) => (
            <li key={t} className="rounded-2xl border border-[#D3ECE7] bg-[#F4FAF8] p-6" data-testid={`how-step-${i + 1}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#17434C] text-[#EAF6F3]"><Icon className="h-5 w-5" /></span>
                <span className="font-mono text-xs font-bold text-[#9A4024]">STEP {i + 1}</span>
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{t}</h3>
              <p className="mt-2 text-[#3D5E65]">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
