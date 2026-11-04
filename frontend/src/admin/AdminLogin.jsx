import { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { startGoogleLogin } from "@/components/GoogleAuth";
import { Logo } from "@/components/Logo";
import { ap, MainLink } from "@/lib/site";

const field = "mt-1 h-11 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm outline-none focus:border-[#17434C]";

export default function AdminLogin({ wrongRole }) {
  const { setUser, logout } = useAuth();
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState(wrongRole ? "This account doesn't have admin access." : "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/login", f);
      if (!["admin", "staff"].includes(data.role)) { await logout(); setErr("This account doesn't have admin access."); return; }
      setUser(data);
    } catch (e2) { setErr(formatErr(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-[#0F3138] px-4" data-testid="admin-login-page">
      <div className="w-full max-w-sm rounded-2xl bg-[#F3F8F7] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-2"><Logo /><span className="rounded bg-[#EE8A63] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F3138]">Admin</span></div>
        <h1 className="mt-6 font-display text-2xl font-semibold">Sign in to the control room</h1>
        <button type="button" onClick={() => startGoogleLogin(ap(""))} data-testid="admin-google-btn"
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-[#D7E7E4] bg-white text-sm font-semibold hover:bg-[#EAF6F3]">Continue with Google</button>
        <div className="my-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]"><span className="h-px flex-1 bg-[#D7E7E4]" />or<span className="h-px flex-1 bg-[#D7E7E4]" /></div>
        <form onSubmit={submit} className="space-y-4" data-testid="admin-login-form">
          <label className="block text-sm font-medium">Email<input required type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={field} data-testid="admin-login-email" /></label>
          <label className="block text-sm font-medium">Password<input required type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={field} data-testid="admin-login-password" /></label>
          {err && <p className="rounded-lg bg-[#FDF0EC] p-3 text-sm text-[#9A4024]" data-testid="admin-login-error">{err}</p>}
          <button disabled={busy} className="h-11 w-full rounded-lg bg-[#B9512E] text-sm font-semibold text-white hover:bg-[#9A4024] disabled:opacity-60" data-testid="admin-login-submit">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="mt-4 flex justify-between text-sm">
          <Link to={ap("/forgot-password")} className="font-semibold text-[#9A4024]" data-testid="admin-forgot-link">Forgot password?</Link>
          <MainLink to="/" className="text-[#3D5E65] hover:underline">Members site</MainLink>
        </div>
      </div>
    </div>
  );
}
