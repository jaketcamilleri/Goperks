import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Gift, Lock } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { captureRef, getRef } from "@/lib/referral";
import { useAuth } from "@/context/AuthContext";
import { MaskLines, Eyebrow, FadeUp } from "@/components/Reveal";
import { PricingTicket } from "@/components/landing/Pricing";
import { MemberCard } from "@/components/MemberCard";
import { ReferralCodeField } from "@/components/ReferralCodeField";

export default function Join() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const active = user?.membership_status === "active";
  const [inviter, setInviter] = useState(null);
  const [price, setPrice] = useState(49);
  const loadPrice = (code) => {
    if (!user || active) return;
    api.get("/payments/my-price", { params: code ? { ref: code } : {} })
      .then((r) => setPrice(Number(r.data?.amount) || 49)).catch(() => setPrice(49));
  };
  useEffect(() => {
    captureRef();
    const ref = getRef();
    if (!ref) return undefined;
    let live = true;
    api.get(`/referrals/${ref}`).then((r) => { if (live) { setInviter(r.data?.first_name || null); if (!user) setPrice(44.92); } }).catch(() => {});
    return () => { live = false; };
  }, []);

  const checkout = async () => {
    if (!user) return nav("/register?next=/join");
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin, ref: getRef() });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatErr(e));
      setBusy(false);
    }
  };

  const locked = active && user?.can_renew === false;
  const opens = locked ? new Date(user.renew_opens_at).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";
  const cta = (
    <>
      {user && !active && <ReferralCodeField className="mt-8 text-left" onChange={loadPrice} />}
      <button onClick={checkout} disabled={busy || locked} data-testid="checkout-btn"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#17434C] py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#B9512E] active:scale-[0.98] disabled:opacity-60">
        <Lock className="h-4 w-4" />
        {busy ? "Opening secure checkout…" : !user ? `Create account & pay $${price === 49 ? 49 : price.toFixed(2)}` : locked ? `Renewal opens ${opens}` : active ? "Renew for another year" : `Pay $${price === 49 ? 49 : price.toFixed(2)} securely`}
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" data-testid="payment-methods">
        {["Visa", "Mastercard", "Apple Pay", "Google Pay"].map((m) => (
          <span key={m} className="rounded-md border border-[#C2DEDA] px-2.5 py-1 font-mono text-[11px] font-bold text-[#3D5E65]">{m}</span>
        ))}
      </div>
    </>
  );

  return (
    <div className="grain relative overflow-hidden" data-testid="checkout-subscription-form">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-28 pt-14 sm:px-8 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-6">
          <Eyebrow>Membership</Eyebrow>
          <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
            lines={[<>Your card to</>, <em key="e" className="font-normal italic text-[#B9512E]">the whole club.</em>]} />
          {inviter && !active && <p className="mt-6 flex items-start gap-2 rounded-2xl bg-[#FDF0EC] p-4 text-[#9A4024]" data-testid="referral-banner"><Gift className="mt-0.5 h-5 w-5 shrink-0" /><span><b>{inviter} invited you.</b> Your first year is $44.92 instead of $49: one month free.</span></p>}
          {active && <p className="mt-6 rounded-2xl bg-[#EBF3EC] p-4 text-[#2F5A3A]" data-testid="already-member-note">You're already a member until {new Date(user.membership_expires_at).toLocaleDateString("en-AU")}. Renewing adds another {12 + Math.round((user.bonus_days_pending ?? 0) / 30)} months{user.bonus_days_pending >= 30 ? ", including the free months you earned by referring friends" : ""}.{locked && <span className="block" data-testid="renew-locked-note">You can renew from <b>{opens}</b>, 2 months before your membership ends.</span>}</p>}
          <p className="mt-6 text-sm text-[#3D5E65]">Buying for someone else? <Link to="/gift" className="font-semibold text-[#9A4024]" data-testid="join-gift-link">Gift a membership →</Link> · Got a gift code? <Link to="/redeem-gift" className="font-semibold text-[#9A4024]" data-testid="join-redeem-link">Claim it</Link></p>
          <FadeUp delay={0.2} className="mt-12 max-w-md">
            <MemberCard name={user?.name || "Your Name"} code={user?.member_code || "GP-XXXXXX"} status={active ? "active" : "preview"} />
          </FadeUp>
        </div>
        <FadeUp delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <div className="rounded-[36px] bg-[#B9512E] p-3 sm:p-4">
            <PricingTicket cta={cta} price={active ? 49 : price} />
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
