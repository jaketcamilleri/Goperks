import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatErr } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";
import { startGoogleLogin } from "@/components/GoogleAuth";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskLines } from "@/components/Reveal";
import { bp, BizLink, MainLink, EXTERNAL_BIZ, EXTERNAL_ADMIN, ADMIN_URL, ap } from "@/lib/site";

const SIDE_IMG = "https://images.unsplash.com/photo-1564327367919-cb377ea6a88f?auto=format&fit=crop&w=1200&q=80";

export default function Auth({ mode, business = false }) {
  const [params] = useSearchParams();
  const next = params.get("next");
  const role = business ? "business" : "member";
  const [f, setF] = useState({ name: "", email: "", password: "", business_name: "" });
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [wrongArea, setWrongArea] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser, logout } = useAuth();
  const nav = useNavigate();
  const isLogin = mode === "login";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const path = (p) => (business ? bp(p) : p);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setWrongArea("");
    if (!isLogin && f.password !== confirm) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      const body = isLogin ? { email: f.email, password: f.password } : { ...f, role, business_name: business ? f.business_name : null };
      const { data } = await api.post(isLogin ? "/auth/login" : "/auth/register", body);
      if (business && data.role === "member") { await logout(); setWrongArea("member"); return; }
      if (!business && data.role === "business" && EXTERNAL_BIZ) { await logout(); setWrongArea("business"); return; }
      setUser(data);
      if (data.role === "admin" && EXTERNAL_ADMIN && !next) { window.location.href = ADMIN_URL; return; }
      const home = data.role === "admin" ? ap("") : data.role === "business" ? bp("") : data.membership_status === "active" ? "/dashboard" : "/join";
      nav(next || (business && data.role === "admin" ? bp("") : home));
    } catch (e2) {
      setErr(formatErr(e2));
    } finally {
      setBusy(false);
    }
  };

  const field = "mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white";
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-2 lg:pt-16" data-testid="auth-modal">
      <div className="max-w-md">
        <div className="mb-8 grid grid-cols-2 rounded-full border border-[#C2DEDA] bg-white p-1" data-testid="auth-mode-switch">
          <Link to={`${path("/login")}${q}`} data-testid="auth-tab-login" className={`rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${isLogin ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65] hover:text-[#17434C]"}`}>Log in</Link>
          <Link to={`${path("/register")}${q}`} data-testid="auth-tab-register" className={`rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${!isLogin ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65] hover:text-[#17434C]"}`}>Create account</Link>
        </div>
        {business && <p className="mb-4 font-mono text-[11px] uppercase tracking-widest text-[#9A4024]" data-testid="auth-partner-eyebrow">Go Perks partners</p>}
        <MaskLines as="h1" className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl"
          lines={business ? (isLogin ? [<>Partner</>, <em key="b" className="font-normal italic text-[#B9512E]">log in.</em>] : [<>Become a</>, <em key="c" className="font-normal italic text-[#B9512E]">partner.</em>])
            : isLogin ? [<>Welcome</>, <em key="b" className="font-normal italic text-[#B9512E]">back.</em>] : [<>Join the</>, <em key="c" className="font-normal italic text-[#B9512E]">little club.</em>]} />
        {!business && (
          <p className="mt-6 rounded-2xl border border-[#C2DEDA] bg-white px-4 py-3 text-sm text-[#3D5E65]" data-testid="auth-business-redirect">
            Own a business? <BizLink to={isLogin ? "/login" : "/register"} className="font-semibold text-[#9A4024]" data-testid="auth-business-link">{isLogin ? "Partner log in →" : "Become a partner →"}</BizLink>
          </p>
        )}
        {!business && (
          <>
            <button type="button" onClick={() => startGoogleLogin(next)} data-testid="google-login-btn"
              className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#C2DEDA] bg-white font-semibold text-[#17434C] transition-[background-color,transform] hover:bg-[#D3ECE7] active:scale-[0.98]">
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
              Continue with Google
            </button>
            <div className="mt-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]"><span className="h-px flex-1 bg-[#C2DEDA]" />or with email<span className="h-px flex-1 bg-[#C2DEDA]" /></div>
          </>
        )}
        <form onSubmit={submit} className="mt-6 space-y-5" data-testid={isLogin ? "login-form" : "register-form"}>
          {!isLogin && (
            <div><Label htmlFor="auth-name">Your name</Label><Input id="auth-name" required autoComplete="name" value={f.name} onChange={set("name")} className={field} data-testid="auth-name-input" /></div>
          )}
          {!isLogin && business && (
            <div><Label htmlFor="auth-biz">Business name</Label><Input id="auth-biz" required autoComplete="organization" value={f.business_name} onChange={set("business_name")} className={field} data-testid="auth-business-input" /></div>
          )}
          <div><Label htmlFor="auth-email">Email</Label><Input id="auth-email" required type="email" inputMode="email" autoComplete="email" autoFocus={isLogin} placeholder="you@example.com" value={f.email} onChange={set("email")} className={field} data-testid="auth-email-input" /></div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {isLogin && <Link to={path("/forgot-password")} className="text-sm font-semibold text-[#9A4024]" data-testid="forgot-password-link">Forgot password?</Link>}
            </div>
            <div className="relative">
              <Input id="auth-password" required type={showPw ? "text" : "password"} minLength={6} autoComplete={isLogin ? "current-password" : "new-password"} value={f.password} onChange={set("password")} className={`${field} pr-12`} data-testid="auth-password-input" />
              <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} data-testid="auth-toggle-password"
                className="absolute right-2 top-[calc(50%+3px)] grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-[#3D5E65] hover:bg-[#D3ECE7]">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {!isLogin && <p className="mt-1.5 text-xs text-[#3D5E65]">At least 6 characters.</p>}
          </div>
          {!isLogin && (
            <div>
              <Label htmlFor="auth-confirm">Confirm password</Label>
              <Input id="auth-confirm" required type={showPw ? "text" : "password"} minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} data-testid="auth-confirm-password-input" />
              {confirm && confirm !== f.password && <p className="mt-1.5 text-xs font-semibold text-[#9A4024]" data-testid="auth-confirm-mismatch">Passwords don't match yet</p>}
              {confirm && confirm === f.password && <p className="mt-1.5 text-xs font-semibold text-[#2F5A3A]" data-testid="auth-confirm-match">Passwords match</p>}
            </div>
          )}
          {err && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#9A4024]" data-testid="auth-error">{err}</p>}
          {wrongArea === "member" && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#9A4024]" data-testid="auth-wrong-area">This login is for business partners. <MainLink to="/login" className="font-semibold underline">Members log in here →</MainLink></p>}
          {wrongArea === "business" && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#9A4024]" data-testid="auth-wrong-area">That's a partner account. <BizLink to="/login" className="font-semibold underline">Log in at the partner area →</BizLink></p>}
          <button disabled={busy} type="submit" data-testid="auth-submit-btn"
            className="w-full rounded-full bg-[#B9512E] py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60">
            {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[#3D5E65]">
          {isLogin ? <>New here? <Link to={`${path("/register")}${q}`} className="font-semibold text-[#9A4024]" data-testid="auth-switch-link">{business ? "Apply to become a partner" : "Create an account"}</Link></>
            : <>Already {business ? "a partner" : "a member"}? <Link to={`${path("/login")}${q}`} className="font-semibold text-[#9A4024]" data-testid="auth-switch-link">Log in</Link></>}
        </p>
      </div>
      <motion.div initial={{ clipPath: "inset(0 0 0 100% round 32px)" }} animate={{ clipPath: "inset(0 0 0 0% round 32px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden min-h-[560px] overflow-hidden lg:block">
        <img src={SIDE_IMG} alt="Coffee at a local cafe" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-[#EAF6F3]/85 p-6 backdrop-blur-xl">
          <p className="font-display text-2xl leading-snug">“Half price at our favourite local — it covered the membership in the first month.”</p>
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-[#9A4024]">Priya · Brunswick</p>
        </div>
      </motion.div>
    </div>
  );
}
