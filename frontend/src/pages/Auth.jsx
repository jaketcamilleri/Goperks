import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatErr } from "@/lib/api";
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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { setUser } = useAuth();
  const nav = useNavigate();
  const isLogin = mode === "login";
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
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

  const field = "mt-1.5 h-12 rounded-xl border-[#E0D7C3] bg-white";
  const q = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-24 pt-12 sm:px-8 lg:grid-cols-2 lg:pt-16" data-testid="auth-modal">
      <div className="max-w-md">
        <MaskLines as="h1" className="font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl"
          lines={isLogin ? [<>Welcome</>, <em key="b" className="font-normal italic text-[#D95329]">back.</em>] : [<>Join the</>, <em key="c" className="font-normal italic text-[#D95329]">little club.</em>]} />
        {!isLogin && (
          <div className="mt-8 inline-flex rounded-full border border-[#E0D7C3] bg-white p-1" data-testid="role-toggle">
            {["member", "business"].map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} data-testid={`role-${r}`}
                className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${role === r ? "bg-[#1E2229] text-[#FBF8F3]" : "text-[#525B68]"}`}>
                {r === "member" ? "I'm a member" : "I'm a business"}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="mt-8 space-y-5" data-testid={isLogin ? "login-form" : "register-form"}>
          {!isLogin && (
            <div><Label>Your name</Label><Input required value={f.name} onChange={set("name")} className={field} data-testid="auth-name-input" /></div>
          )}
          {!isLogin && role === "business" && (
            <div><Label>Business name</Label><Input required value={f.business_name} onChange={set("business_name")} className={field} data-testid="auth-business-input" /></div>
          )}
          <div><Label>Email</Label><Input required type="email" value={f.email} onChange={set("email")} className={field} data-testid="auth-email-input" /></div>
          <div><Label>Password</Label><Input required type="password" minLength={6} value={f.password} onChange={set("password")} className={field} data-testid="auth-password-input" /></div>
          {isLogin && <Link to="/forgot-password" className="-mt-2 block text-right text-sm font-semibold text-[#B63F18]" data-testid="forgot-password-link">Forgot password?</Link>}
          {err && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#B63F18]" data-testid="auth-error">{err}</p>}
          <button disabled={busy} type="submit" data-testid="auth-submit-btn"
            className="w-full rounded-full bg-[#D95329] py-4 font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#B63F18] active:scale-[0.98] disabled:opacity-60">
            {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
          </button>
        </form>
        <p className="mt-6 text-sm text-[#525B68]">
          {isLogin ? <>New here? <Link to={`/register${q}`} className="font-semibold text-[#B63F18]" data-testid="auth-switch-link">Create an account</Link></>
            : <>Already a member? <Link to={`/login${q}`} className="font-semibold text-[#B63F18]" data-testid="auth-switch-link">Log in</Link></>}
        </p>
      </div>
      <motion.div initial={{ clipPath: "inset(0 0 0 100% round 32px)" }} animate={{ clipPath: "inset(0 0 0 0% round 32px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative hidden min-h-[560px] overflow-hidden lg:block">
        <img src={SIDE_IMG} alt="Coffee at a local cafe" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-6 bottom-6 rounded-2xl bg-[#FBF8F3]/85 p-6 backdrop-blur-xl">
          <p className="font-display text-2xl leading-snug">“Half price at our favourite local — it covered the membership in the first month.”</p>
          <p className="mt-3 font-mono text-xs uppercase tracking-widest text-[#B63F18]">Priya · Brunswick</p>
        </div>
      </motion.div>
    </div>
  );
}
