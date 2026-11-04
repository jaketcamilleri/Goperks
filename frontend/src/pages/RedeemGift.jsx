import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MaskLines, Eyebrow } from "@/components/Reveal";

export default function RedeemGift() {
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const { user, setUser } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (code.length < 10) { setInfo(null); return undefined; }
    const t = setTimeout(() => {
      api.get(`/gifts/${encodeURIComponent(code)}`).then((r) => setInfo(r.data || null)).catch(() => setInfo(false));
    }, 300);
    return () => clearTimeout(t);
  }, [code]);

  const redeem = async () => {
    if (!user) { nav(`/register?next=${encodeURIComponent(`/redeem-gift?code=${code}`)}`); return; }
    setBusy(true);
    try {
      const { data } = await api.post("/gifts/redeem", { code });
      setUser(data);
      toast.success("Your membership is active — welcome to the club!");
      nav("/dashboard");
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-xl px-5 pb-28 pt-14" data-testid="redeem-gift-page">
      <Eyebrow>Claim your gift</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl"
        lines={[<>Someone thinks</>, <em key="r" className="font-normal italic text-[#D95329]">you deserve this.</em>]} />
      <label className="mt-10 block font-mono text-xs uppercase tracking-widest text-[#525B68]" htmlFor="gift-code">Gift code</label>
      <input id="gift-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX" data-testid="redeem-code-input"
        className="mt-2 h-14 w-full rounded-full border border-[#E0D7C3] bg-white px-6 font-mono text-lg tracking-[0.15em] outline-none focus:border-[#1E2229]" />
      {info && (
        <div className="mt-6 rounded-[24px] bg-[#1E2229] p-6 text-[#FBF8F3]" data-testid="redeem-gift-info">
          <p className="font-display text-2xl">For {info.recipient_name}, from {info.from_name}</p>
          {info.message && <p className="mt-3 border-l-2 border-[#F3A72E] pl-4 font-display italic text-[#E5DEC9]">“{info.message}”</p>}
          {info.status !== "unredeemed" && <p className="mt-3 text-sm text-[#F3A72E]">This gift has already been claimed.</p>}
        </div>
      )}
      {info === false && <p className="mt-6 rounded-2xl bg-[#FDF0EC] p-4 text-sm text-[#B63F18]" data-testid="redeem-gift-invalid">We couldn't find that gift code.</p>}
      <button onClick={redeem} disabled={busy || !info || info.status !== "unredeemed"} data-testid="redeem-gift-btn"
        className="mt-6 w-full rounded-full bg-[#D95329] py-4 font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#B63F18] active:scale-[0.98] disabled:opacity-50">
        {busy ? "Activating…" : user ? "Start my 12 months" : "Create account to claim"}
      </button>
      {!user && <p className="mt-4 text-center text-sm text-[#525B68]">Already a member? <Link to={`/login?next=${encodeURIComponent(`/redeem-gift?code=${code}`)}`} className="font-semibold text-[#B63F18]">Log in</Link></p>}
    </div>
  );
}
