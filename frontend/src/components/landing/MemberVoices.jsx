import { useEffect, useState } from "react";
import { Quote } from "lucide-react";
import { api } from "@/lib/api";
import { Stars } from "@/components/Stars";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FALLBACK = [
  { q: "We've saved so much on weekend outings already. The kids pick a deal, we show the card, everyone's happy.", n: "Mel", s: "Newtown" },
  { q: "Half price at our favourite local restaurant, and it more than covered the yearly membership in the first month.", n: "Priya", s: "Brunswick" },
  { q: "Love how easy it is. No clunky vouchers, just our phones at the counter. We've discovered so many new places nearby.", n: "Josh & Amy", s: "Fitzroy" },
];

export function MemberVoices() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/reviews/highlights").then((r) => setRows(Array.isArray(r.data) ? r.data.slice(0, 3) : [])).catch(() => setRows([]));
  }, []);
  const real = rows.length >= 2;
  const items = real ? rows.map((r) => ({ q: r.comment, n: r.name, s: r.business_name, rating: r.rating, id: r.id })) : FALLBACK;

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24" data-testid="member-voices">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">{real ? "Latest member reviews" : "What members say"}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Real people, real savings.</h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {items.map((t, i) => (
          <figure key={t.id || t.n} className="flex flex-col justify-between rounded-2xl border border-[#D3ECE7] bg-white p-6" data-testid={`member-voice-${i}`}>
            <div>
              {t.rating ? <Stars value={t.rating} /> : <Quote className="h-6 w-6 text-[#EE8A63]" />}
              <blockquote className="mt-4 text-lg leading-relaxed text-[#17434C]">“{t.q}”</blockquote>
            </div>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#D3ECE7] font-display font-semibold">{t.n[0]}</span>
              <span><span className="block font-semibold">{t.n}</span><span className="text-sm text-[#3D5E65]">{t.s}</span></span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  ["How long does a membership last?", "12 months from the day you join. We email you before it's due so you can renew."],
  ["How do I use a deal?", "Open the deal and either show your live member card for the partner to scan, or tap “Get my voucher code” and show the code at the counter."],
  ["Can I use a deal more than once?", "Each deal can be used once per membership year. It unlocks again when you renew."],
  ["Why does my card have a moving clock?", "The live clock and changing QR code prove it's your real card, not a screenshot. Partners check it at the counter."],
  ["How does refer a friend work?", "Every member gets their own referral code, shown on their dashboard. Your friend types it in when they sign up (or uses your invite link). Once they pay, you both get a free month added to your membership. You can earn up to 12 free months a year."],
  ["Can I give Go Perks as a present?", "Yes. Buy a gift membership, add a message and pick the day it arrives in their inbox."],
  ["I run a local business. How do I join?", "Apply in the partner area. Once we approve you, add your profile and submit your first deal."],
];

export function Faq() {
  return (
    <section className="bg-white" data-testid="faq-section">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">Questions</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Good to know</h2>
        </div>
        <Accordion type="single" collapsible className="lg:col-span-8">
          {FAQ.map(([q, a], i) => (
            <AccordionItem key={q} value={`q${i}`} className="border-[#D3ECE7]" data-testid={`faq-item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">{q}</AccordionTrigger>
              <AccordionContent className="text-base text-[#3D5E65]">{a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
