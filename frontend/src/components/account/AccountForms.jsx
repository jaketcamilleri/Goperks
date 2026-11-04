import { useState } from "react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const field = "mt-1.5 h-11 rounded-xl border-[#C2DEDA] bg-white";
export const panel = "rounded-[24px] border border-[#C2DEDA] bg-white p-5 sm:p-7";
export const saveBtn = "mt-5 inline-flex rounded-full bg-[#17434C] px-6 py-3 text-sm font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#0F3138] active:scale-[0.98] disabled:opacity-50";

export function DetailsForm() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user?.name || "", email: user?.email || "", phone: user?.phone || "", current_password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const emailChanged = f.email.trim().toLowerCase() !== (user?.email || "");

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch("/me", { ...f, phone: f.phone || null, current_password: f.current_password || null });
      setUser(data); setF((s) => ({ ...s, current_password: "" }));
      toast.success("Details saved");
    } catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className={panel} data-testid="account-details-form">
      <h2 className="font-display text-2xl font-semibold">Your details</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="acc-name">Name</Label><Input id="acc-name" value={f.name} onChange={set("name")} required maxLength={80} className={field} data-testid="account-name-input" /></div>
        <div><Label htmlFor="acc-phone">Phone <span className="font-normal text-[#3D5E65]">(optional)</span></Label><Input id="acc-phone" value={f.phone} onChange={set("phone")} maxLength={30} className={field} data-testid="account-phone-input" /></div>
        <div className="sm:col-span-2"><Label htmlFor="acc-email">Email</Label><Input id="acc-email" type="email" value={f.email} onChange={set("email")} required className={field} data-testid="account-email-input" /></div>
        {emailChanged && user?.has_password && (
          <div className="sm:col-span-2"><Label htmlFor="acc-cur">Current password <span className="font-normal text-[#3D5E65]">(needed to change your email)</span></Label>
            <Input id="acc-cur" type="password" value={f.current_password} onChange={set("current_password")} className={field} data-testid="account-email-password-input" /></div>
        )}
      </div>
      <button disabled={busy} className={saveBtn} data-testid="account-details-save-btn">{busy ? "Saving…" : "Save details"}</button>
    </form>
  );
}

export function PasswordForm() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const hasPw = !!user?.has_password;

  const save = async (e) => {
    e.preventDefault();
    if (f.next !== f.confirm) { toast.error("New passwords don't match"); return; }
    setBusy(true);
    try {
      await api.post("/me/password", { current_password: hasPw ? f.current : null, new_password: f.next });
      setF({ current: "", next: "", confirm: "" });
      if (!hasPw) setUser({ ...user, has_password: true });
      toast.success(hasPw ? "Password changed" : "Password set");
    } catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className={panel} data-testid="account-password-form">
      <h2 className="font-display text-2xl font-semibold">{hasPw ? "Change password" : "Set a password"}</h2>
      {!hasPw && <p className="mt-1 text-sm text-[#3D5E65]">You sign in with Google. Set a password if you'd also like to log in with your email.</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {hasPw && <div><Label htmlFor="pw-cur">Current password</Label><Input id="pw-cur" type="password" value={f.current} onChange={set("current")} required className={field} data-testid="password-current-input" /></div>}
        <div><Label htmlFor="pw-new">New password</Label><Input id="pw-new" type="password" value={f.next} onChange={set("next")} required minLength={8} className={field} data-testid="password-new-input" /></div>
        <div><Label htmlFor="pw-confirm">Confirm new password</Label><Input id="pw-confirm" type="password" value={f.confirm} onChange={set("confirm")} required minLength={8} className={field} data-testid="password-confirm-input" /></div>
      </div>
      <p className="mt-2 text-xs text-[#3D5E65]">At least 8 characters.</p>
      <button disabled={busy} className={saveBtn} data-testid="password-save-btn">{busy ? "Saving…" : hasPw ? "Change password" : "Set password"}</button>
    </form>
  );
}
