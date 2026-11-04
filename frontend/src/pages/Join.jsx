import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MaskLines, Eyebrow, FadeUp } from "@/components/Reveal";
import { PricingTicket } from "@/components/landing/Pricing";
import { MemberCard } from "@/components/MemberCard";

export default function Join() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const active = user?.membership_status === "active";

  const checkout = async () => {
    if (!user) return nav("/register?next=/join");
    setBusy(true);
    try {
      const { data } = await api.post("/payments/checkout", { origin_url: window.location.origin });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatErr(e));
      setBusy(false);
    }
  };

  const cta = (
    <>
      <button onClick={checkout} disabled={busy} data-testid="checkout-btn"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-[#1E2229] py-4 font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#D95329] active:scale-[0.98] disabled:opacity-60">
        <Lock className="h-4 w-4" />
        {busy ? "Opening secure checkout…" : !user ? "Create account & pay $49" : active ? "Renew for another year" : "Pay $49 securely"}
      </button>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2" data-testid="payment-methods">
        {["Visa", "Mastercard", "Apple Pay", "Google Pay"].map((m) => (
          <span key={m} className="rounded-md border border-[#E0D7C3] px-2.5 py-1 font-mono text-[11px] font-bold text-[#525B68]">{m}</span>
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
            lines={[<>Your card to</>, <em key="e" className="font-normal italic text-[#D95329]">the whole club.</em>]} />
          <p className="mt-6 max-w-lg text-[#525B68] md:text-lg">
            Pay once a year, save all year. Checkout is handled securely by Stripe — Apple Pay and Google Pay appear automatically on supported devices.
          </p>
          {active && <p className="mt-6 rounded-2xl bg-[#EBF3EC] p-4 text-[#2F5A3A]" data-testid="already-member-note">You're already a member until {new Date(user.membership_expires_at).toLocaleDateString("en-AU")}. Renewing adds another 12 months.</p>}
          <p className="mt-6 text-sm text-[#525B68]">Buying for someone else? <Link to="/gift" className="font-semibold text-[#B63F18]" data-testid="join-gift-link">Gift a membership →</Link> · Got a gift code? <Link to="/redeem-gift" className="font-semibold text-[#B63F18]" data-testid="join-redeem-link">Claim it</Link></p>
          <FadeUp delay={0.2} className="mt-12 max-w-md">
            <MemberCard name={user?.name || "Your Name"} code={user?.member_code || "LP-XXXXXX"} status={active ? "active" : "preview"} />
          </FadeUp>
        </div>
        <FadeUp delay={0.1} className="lg:col-span-5 lg:col-start-8">
          <div className="rounded-[36px] bg-[#D95329] p-3 sm:p-4">
            <PricingTicket cta={cta} />
          </div>
        </FadeUp>
      </div>
    </div>
  );
}
