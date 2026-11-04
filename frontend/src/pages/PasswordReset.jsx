import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskLines } from "@/components/Reveal";

const field = "mt-1.5 h-12 rounded-xl border-[#E0D7C3] bg-white";
const btn = "w-full rounded-full bg-[#D95329] py-4 font-semibold text-[#FBF8F3] transition-[background-color,transform] hover:bg-[#B63F18] active:scale-[0.98] disabled:opacity-60";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try { await api.post("/auth/forgot-password", { email }); setSent(true); }
    catch (e2) { setErr(formatErr(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-14" data-testid="forgot-password-page">
      <MaskLines as="h1" className="font-display text-5xl font-semibold leading-[0.95] tracking-tight"
        lines={[<>Forgot your</>, <em key="p" className="font-normal italic text-[#D95329]">password?</em>]} />
      {sent ? (
        <p className="mt-8 rounded-2xl bg-[#EBF3EC] p-5 text-[#2F5A3A]" data-testid="forgot-sent">If that email has an account, a reset link is on its way. It expires in 1 hour.</p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5" data-testid="forgot-form">
          <p className="text-[#525B68]">Enter your account email and we'll send you a link to choose a new password.</p>
          <div><Label>Email</Label><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} data-testid="forgot-email-input" /></div>
          {err && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#B63F18]" data-testid="forgot-error">{err}</p>}
          <button disabled={busy} className={btn} data-testid="forgot-submit-btn">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-[#B63F18]" data-testid="forgot-back-login">← Back to log in</Link>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    setBusy(true);
    setErr("");
    try {
      await api.post("/auth/reset-password", { token, password: pw });
      toast.success("Password updated — please log in");
      nav("/login");
    } catch (e2) { setErr(formatErr(e2)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-5 pb-28 pt-14" data-testid="reset-password-page">
      <MaskLines as="h1" className="font-display text-5xl font-semibold leading-[0.95] tracking-tight"
        lines={[<>Choose a new</>, <em key="p" className="font-normal italic text-[#D95329]">password.</em>]} />
      <form onSubmit={submit} className="mt-8 space-y-5" data-testid="reset-form">
        <div><Label>New password</Label><Input required type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} className={field} data-testid="reset-password-input" /></div>
        <div><Label>Confirm password</Label><Input required type="password" minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} className={field} data-testid="reset-password-confirm-input" /></div>
        {err && <p className="rounded-xl bg-[#FDF0EC] p-3 text-sm text-[#B63F18]" data-testid="reset-error">{err}</p>}
        <button disabled={busy || !token} className={btn} data-testid="reset-submit-btn">{busy ? "Saving…" : "Update password"}</button>
      </form>
    </div>
  );
}
