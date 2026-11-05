import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Gift, Lock } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MaskLines, Eyebrow, FadeUp } from "@/components/Reveal";
import { MemberCard } from "@/components/MemberCard";
import { Confetti } from "@/components/Fun";

const GIFT_CONFETTI = [["star", "#FFD166", "left-[3%] top-8 h-8 w-8", 10], ["dot", "#FF70A6", "left-[45%] top-20 h-4 w-4"], ["squiggle", "#4CC9F0", "left-[30%] bottom-10 h-5 w-20", -6], ["star", "#7054CB", "right-[3%] bottom-24 h-6 w-6", 14]];

const field = "mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white";

export default function GiftPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ gift_name: "", gift_email: "", gift_message: "", gift_send_date: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
  const maxDate = (() => { const d = new Date(today + "T00:00:00"); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); return d.toLocaleDateString("en-CA"); })();

  const submit = async (e) => {
    e.preventDefault();
    if (!user) { nav("/register?next=/gift"); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", { ...f, gift_send_date: f.gift_send_date || null, kind: "gift", origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e2) {
      toast.error(formatErr(e2));
      setBusy(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-white" data-testid="gift-page">
      <Confetti items={GIFT_CONFETTI} />
      <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-28 pt-14 sm:px-8 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-6">
          <Eyebrow>Gift a membership</Eyebrow>
          <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
            lines={[<>A whole year</>, <em key="g" className="font-normal italic text-[#B9512E]">of days out.</em>]} />
          <p className="mt-6 max-w-lg text-[#3D5E65] md:text-lg">
            Give family or friends 12 months of local deals for A$49. We email them a gift code and your note straight after you pay — they claim it whenever they're ready.
          </p>
          <FadeUp delay={0.2} className="mt-12 max-w-md rotate-[-3deg]">
            <MemberCard name={f.gift_name || "Someone special"} code="GIFT" expires="12 months" status="preview" />
          </FadeUp>
        </div>
        <FadeUp delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <form onSubmit={submit} className="pop rounded-[32px] border-[3px] border-[#17434C] bg-white p-6 sm:p-8" data-testid="gift-form">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-[#17434C] bg-[#FF70A6]"><Gift className="h-5 w-5 text-[#17434C]" /></span>
              <p className="font-display text-2xl font-semibold">Who's it for?</p>
            </div>
            <div className="mt-6 space-y-5">
              <div><Label>Their name</Label><Input required maxLength={80} value={f.gift_name} onChange={set("gift_name")} className={field} data-testid="gift-name-input" /></div>
              <div><Label>Their email</Label><Input required type="email" value={f.gift_email} onChange={set("gift_email")} className={field} data-testid="gift-email-input" /></div>
              <div><Label>Personal note (optional)</Label><Textarea maxLength={300} value={f.gift_message} onChange={set("gift_message")} placeholder="Happy birthday! Enjoy some weekend adventures." className="mt-1.5 min-h-[96px] rounded-xl border-[#C2DEDA] bg-white" data-testid="gift-message-input" /></div>
              <div>
                <Label htmlFor="gift-date">Delivery date</Label>
                <Input id="gift-date" type="date" min={today} max={maxDate} value={f.gift_send_date} onChange={set("gift_send_date")} className={field} data-testid="gift-date-input" />
                <p className="mt-1.5 text-xs text-[#3D5E65]" data-testid="gift-date-hint">
                  {f.gift_send_date && f.gift_send_date > today
                    ? `We'll email it at 7am (Melbourne time) on ${new Date(f.gift_send_date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}.`
                    : "Leave empty to send straight after payment, or pick a birthday or Christmas morning."}
                </p>
              </div>
            </div>
            <p className="mt-6 flex items-end gap-2"><span className="font-display text-5xl font-semibold">$49</span><span className="pb-1 text-[#3D5E65]">AUD, one-off — no auto-renew</span></p>
            <button disabled={busy} data-testid="gift-checkout-btn"
              className="pop pop-hover mt-6 flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#17434C] bg-[#B9512E] py-4 font-bold text-white hover:bg-[#9A4024] disabled:opacity-60">
              <Lock className="h-4 w-4" /> {busy ? "Opening secure checkout…" : user ? "Pay $49 & send gift" : "Create account & pay $49"}
            </button>
            <p className="mt-3 text-center text-xs text-[#3D5E65]">Card, Apple Pay or Google Pay via Stripe.</p>
          </form>
        </FadeUp>
      </div>
    </div>
  );
}
