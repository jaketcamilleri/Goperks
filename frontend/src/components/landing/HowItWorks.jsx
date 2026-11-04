import { motion } from "framer-motion";
import { Eyebrow, FadeUp } from "@/components/Reveal";

const STEPS = [
  { n: "01", t: "Join online", d: "One simple yearly membership — $49 covers your whole household. Pay by card, Apple Pay or Google Pay." },
  { n: "02", t: "Browse the offers", d: "Cafes, kids activities, restaurants and days out, all near your suburb. New deals added all the time." },
  { n: "03", t: "Show & save", d: "Flash your digital member card or a one-off voucher code at the counter. That's it — no clunky paper." },
];

export function HowItWorks() {
  return (
    <section id="how" className="grain relative bg-[#0F3138] text-[#EAF6F3]" data-testid="how-it-works">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:py-36">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <Eyebrow className="!text-[#EE8A63]">Simple as pie</Eyebrow>
            <FadeUp>
              <h2 className="mt-5 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
                Three steps <em className="font-normal italic text-[#EE8A63]">to saving</em> every weekend.
              </h2>
            </FadeUp>
            <p className="mt-6 max-w-md text-[#BFD9D6] md:text-lg">Every deal is submitted by a local business and checked by us before it goes live.</p>
          </div>
        </div>
        <ol className="lg:col-span-6 lg:col-start-7">
          {STEPS.map((s, i) => (
            <motion.li key={s.n} data-testid={`how-step-${i + 1}`}
              initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
              className="group border-t border-white/15 py-10 last:border-b">
              <div className="flex gap-6 sm:gap-10">
                <span className="font-display text-6xl font-semibold italic text-[#B9512E] transition-colors group-hover:text-[#EE8A63] sm:text-7xl">{s.n}</span>
                <div className="pt-2">
                  <h3 className="font-display text-2xl font-semibold sm:text-3xl">{s.t}</h3>
                  <p className="mt-3 max-w-md text-[#BFD9D6]">{s.d}</p>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
