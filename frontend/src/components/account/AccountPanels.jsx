import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { panel, saveBtn } from "@/components/account/AccountForms";

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "—");
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export function MembershipPanel() {
  const { user } = useAuth();
  const [pays, setPays] = useState(null);
  useEffect(() => { api.get("/me/payments").then((r) => setPays(Array.isArray(r.data) ? r.data : [])).catch(() => setPays([])); }, []);
  const active = user?.membership_status === "active";
  const months = Math.round((user?.bonus_days_pending ?? 0) / 30);

  return (
    <section className={panel} data-testid="account-membership">
      <h2 className="font-display text-2xl font-semibold">Membership</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div><dt className="text-xs uppercase tracking-wider text-[#3D5E65]">Status</dt>
          <dd className={`mt-1 font-semibold ${active ? "text-[#2F5A3A]" : "text-[#9A4024]"}`} data-testid="account-status">{active ? "Active" : user?.membership_status === "expired" ? "Ended" : "Not active"}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-[#3D5E65]">{active ? "Renews by" : "Ended"}</dt><dd className="mt-1 font-semibold" data-testid="account-expiry">{day(user?.membership_expires_at)}</dd></div>
        <div><dt className="text-xs uppercase tracking-wider text-[#3D5E65]">Member number</dt><dd className="mt-1 font-mono font-semibold" data-testid="account-member-code">{user?.member_code || "—"}</dd></div>
      </dl>
      {months > 0 && <p className="mt-4 text-sm text-[#2F5A3A]" data-testid="account-bonus">{months} free month{months === 1 ? "" : "s"} saved from referrals, added when you renew.</p>}
      {active && user?.can_renew === false ? (
        <p className="mt-5 rounded-xl bg-[#F3F8F7] px-4 py-3 text-sm text-[#3D5E65]" data-testid="account-renew-locked">
          You can renew from <b>{day(user.renew_opens_at)}</b>, 2 months before your membership ends.
        </p>
      ) : <Link to="/join" className={saveBtn} data-testid="account-renew-btn">{active ? "Renew for another year" : "Activate membership"}</Link>}
      <h3 className="mt-8 font-semibold">Payment history</h3>
      {pays?.length ? (
        <ul className="mt-2 divide-y divide-[#E3F0ED] text-sm" data-testid="account-payments">
          {pays.map((p, i) => (
            <li key={i} className="flex justify-between gap-3 py-2.5">
              <span>{p.kind === "gift" ? `Gift membership${p.gift_name ? ` for ${p.gift_name}` : ""}` : "Yearly membership"}<span className="block text-xs text-[#3D5E65]">{day(p.created_at)}</span></span>
              <span className="font-semibold">{money(p.amount)} {(p.currency || "aud").toUpperCase()}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-[#3D5E65]" data-testid="account-payments-empty">{pays ? "No payments yet." : "Loading…"}</p>}
    </section>
  );
}

export function GiftsPanel() {
  const { refresh } = useAuth();
  const nav = useNavigate();
  const [gifts, setGifts] = useState([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/me/gifts").then((r) => setGifts(Array.isArray(r.data) ? r.data : [])).catch(() => setGifts([])); }, []);

  const redeem = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { await api.post("/gifts/redeem", { code: code.trim() }); await refresh(); toast.success("Gift added to your membership"); setCode(""); nav("/"); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  return (
    <section className={panel} data-testid="account-gifts">
      <h2 className="font-display text-2xl font-semibold">Gift codes</h2>
      <form onSubmit={redeem} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-semibold">Have a gift code?
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="GIFT-XXXX-XXXX" className="mt-1.5 h-11 rounded-xl border-[#C2DEDA] font-mono uppercase" data-testid="account-gift-code-input" />
        </label>
        <button disabled={busy || code.trim().length < 6} className={saveBtn.replace("mt-5 ", "")} data-testid="account-gift-redeem-btn">{busy ? "Adding…" : "Use code"}</button>
      </form>
      <div className="mt-6 flex items-center justify-between"><h3 className="font-semibold">Gifts you've bought</h3><Link to="/gift" className="text-sm font-semibold text-[#9A4024]" data-testid="account-buy-gift-link">Give a gift →</Link></div>
      {gifts.length ? (
        <ul className="mt-2 divide-y divide-[#E3F0ED] text-sm" data-testid="account-gifts-list">
          {gifts.map((g) => (
            <li key={g.code} className="flex justify-between gap-3 py-2.5">
              <span>{g.recipient_name}<span className="block font-mono text-xs text-[#3D5E65]">{g.code}</span></span>
              <span className="text-[#3D5E65]">{g.status === "redeemed" ? "Claimed" : g.email_sent ? "Sent" : `Sending ${g.send_on || ""}`}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm text-[#3D5E65]">None yet.</p>}
    </section>
  );
}
