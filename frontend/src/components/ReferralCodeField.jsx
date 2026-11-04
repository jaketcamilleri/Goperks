import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { api } from "@/lib/api";
import { captureRef, getRef, setRef, REF_PATTERN } from "@/lib/referral";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Optional friend's code box. Pre-fills from an invite link; checks the code and remembers it when valid. */
export function ReferralCodeField({ className = "", inputClassName = "" }) {
  const [code, setCode] = useState(() => { captureRef(); return getRef() || ""; });
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    const c = code.trim().toUpperCase();
    if (!c) { setRef(null); setState({ status: "idle" }); return undefined; }
    if (!REF_PATTERN.test(c)) { setRef(null); setState({ status: "bad" }); return undefined; }
    let live = true;
    setState({ status: "checking" });
    const t = setTimeout(() => {
      api.get(`/referrals/${c}`)
        .then((r) => { if (!live) return; setRef(c); setState({ status: "ok", name: r.data?.first_name || "A friend" }); })
        .catch(() => { if (!live) return; setRef(null); setState({ status: "bad" }); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [code]);

  return (
    <div className={className} data-testid="referral-code-field">
      <Label htmlFor="referral-code">Friend's referral code <span className="font-normal text-[#3D5E65]">(optional)</span></Label>
      <Input id="referral-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. REFAB12CD" autoComplete="off" maxLength={20}
        className={`mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white font-mono uppercase tracking-wider ${inputClassName}`} data-testid="referral-code-input" />
      {state.status === "ok" && <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#2F5A3A]" data-testid="referral-code-valid"><Gift className="h-3.5 w-3.5" /> {state.name} invited you. You'll both get a free month once you pay.</p>}
      {state.status === "bad" && <p className="mt-1.5 text-xs font-semibold text-[#9A4024]" data-testid="referral-code-invalid">We couldn't find that code. Check it with your friend, or leave it blank.</p>}
      {state.status === "checking" && <p className="mt-1.5 text-xs text-[#3D5E65]" data-testid="referral-code-checking">Checking code…</p>}
    </div>
  );
}
