import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MemberCard } from "@/components/MemberCard";
import { MaskLines } from "@/components/Reveal";

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { refresh } = useAuth();
  const [state, setState] = useState("checking");
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!sessionId) { setState("error"); return undefined; }
    let tries = 0;
    let timer;
    let stopped = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data?.payment_status === "paid") {
          const u = await refresh();
          if (!stopped) { setMe(u); setState("paid"); }
          return;
        }
      } catch (e) { /* keep polling */ }
      tries += 1;
      if (tries >= 15) { if (!stopped) setState("timeout"); return; }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, refresh]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:px-8" data-testid="payment-success-page">
      {state === "paid" ? (
        <>
          <MaskLines as="h1" className="font-display text-5xl font-semibold tracking-tight sm:text-6xl"
            lines={[<>Welcome to <em className="font-normal italic text-[#D95329]">the club!</em></>]} testId="payment-success-title" />
          <p className="mt-5 text-[#525B68] md:text-lg">Your membership is active. Here's your digital card — show it at the counter.</p>
          <div className="mx-auto mt-12 max-w-md">
            <MemberCard name={me?.name} code={me?.member_code} status="active"
              expires={me?.membership_expires_at ? new Date(me.membership_expires_at).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : undefined} />
          </div>
          <div className="mt-12 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/deals" className="rounded-full bg-[#D95329] px-7 py-4 font-semibold text-[#FBF8F3]" data-testid="success-browse-btn">Start browsing deals</Link>
            <Link to="/dashboard" className="rounded-full border border-[#1E2229] px-7 py-4 font-semibold" data-testid="success-dashboard-btn">Go to my account</Link>
          </div>
        </>
      ) : state === "checking" ? (
        <p className="font-display text-3xl" data-testid="payment-checking">Confirming your payment…</p>
      ) : (
        <>
          <p className="font-display text-3xl" data-testid="payment-error">We couldn't confirm your payment yet.</p>
          <p className="mt-4 text-[#525B68]">If you were charged, your membership will activate shortly. Check your account in a minute.</p>
          <Link to="/dashboard" className="mt-8 inline-flex rounded-full bg-[#1E2229] px-7 py-4 font-semibold text-[#FBF8F3]">My account</Link>
        </>
      )}
    </div>
  );
}

export function PaymentCancel() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-28 text-center" data-testid="payment-cancel-page">
      <h1 className="font-display text-5xl font-semibold tracking-tight">No worries.</h1>
      <p className="mt-4 text-[#525B68] md:text-lg">Your payment was cancelled and you haven't been charged.</p>
      <Link to="/join" className="mt-10 inline-flex rounded-full bg-[#D95329] px-7 py-4 font-semibold text-[#FBF8F3]" data-testid="cancel-retry-btn">Try again</Link>
    </div>
  );
}
