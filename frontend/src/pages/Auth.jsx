import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatErr } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskLines } from "@/components/Reveal";

const SIDE_IMG = "https://images.unsplash.com/photo-1564327367919-cb377ea6a88f?auto=format&fit=crop&w=1200&q=80";

export default function Auth({ mode }) {
  const [params] = useSearchParams();
  const next = params.get("next");
  const [role, setRole] = useState(params.get("role") === "business" ? "business" : "member");
  const [f, setF] = useState({ name: "", email: "", password: "", business_name: "" });
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();
  const isLogin = mode === "login";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!isLogin && f.password !== confirm) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      const body = isLogin ? { email: f.email, password: f.password } : { ...f, role, business_name: role === "business" ? f.business_name : null };
      const { data } = await api.post(isLogin ? "/auth/login" : "/auth/register", body);
      setUser(data);
      const home = data.role === "admin" ? "/admin" : data.role === "business" ? "/business" : data.membership_status === "active" ? "/dashboard" : "/join";
      nav(next || home);
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
          <Link to={`/login${q}`} data-testid="auth-tab-login" className={`rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${isLogin ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65] hover:text-[#17434C]"}`}>Log in</Link>
          <Link to={`/register${q}`} data-testid="auth-tab-register" className={`rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${!isLogin ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65] hover:text-[#17434C]"}`}>Create account</Link>
        </div>
        <MaskLines as="h1" className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl"
          lines={isLogin ? [<>Welcome</>, <em key="b" className="font-normal italic text-[#B9512E]">back.</em>] : [<>Join the</>, <em key="c" className="font-normal italic text-[#B9512E]">little club.</em>]} />
        {!isLogin && (
          <div className="mt-8 inline-flex rounded-full border border-[#C2DEDA] bg-white p-1" data-testid="role-toggle">
            {["member", "business"].map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} data-testid={`role-${r}`}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${role === r ? "bg-[#17434C] text-[#EAF6F3]" : "text-[#3D5E65]"}`}>
                {r === "member" ? "I'm a member" : "I'm a business"}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="mt-8 space-y-5" data-testid={isLogin ? "login-form" : "register-form"}>
          {!isLogin && (
            <div><Label htmlFor="auth-name">Your name</Label><Input id="auth-name" required autoComplete="name" value={f.name} onChange={set("name")} className={field} data-testid="auth-name-input" /></div>
          )}
          {!isLogin && role === "business" && (
            <div><Label htmlFor="auth-biz">Business name</Label><Input id="auth-biz" required autoComplete="organization" value={f.business_name} onChange={set("business_name")} className={field} data-testid="auth-business-input" /></div>
          )}
          <div><Label htmlFor="auth-email">Email</Label><Input id="auth-email" required type="email" inputMode="email" autoComplete="email" autoFocus={isLogin} placeholder="you@example.com" value={f.email} onChange={set("email")} className={field} data-testid="auth-email-input" /></div>
          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {isLogin && <Link to="/forgot-password" className="text-sm font-semibold text-[#9A4024]" data-testid="forgot-password-link">Forgot password?</Link>}
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
          <button disabled={busy} type="submit" data-testid="auth-submit-btn"
            className="w-full rounded-full bg-[#B9512E] py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60">
            {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[#3D5E65]">
          {isLogin ? <>New here? <Link to={`/register${q}`} className="font-semibold text-[#9A4024]" data-testid="auth-switch-link">Create an account</Link></>
            : <>Already a member? <Link to={`/login${q}`} className="font-semibold text-[#9A4024]" data-testid="auth-switch-link">Log in</Link></>}
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
