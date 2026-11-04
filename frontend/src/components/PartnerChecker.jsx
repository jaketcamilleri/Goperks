import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { api, formatErr } from "@/lib/api";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU") : "—");

function Result({ r, onRedeem, busy }) {
  const ok = r.status === "active";
  const Icon = ok ? CheckCircle2 : XCircle;
  const title = r.type === "member"
    ? ok ? `${r.member_name}'s membership is active` : `${r.member_name}'s membership is ${r.status}`
    : ok ? "Valid voucher" : `Voucher ${r.status}`;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl p-5 ${ok ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#FDF0EC] text-[#B63F18]"}`} data-testid="partner-check-result">
      <p className="flex items-center gap-2 font-display text-xl font-semibold" data-testid="partner-check-status"><Icon className="h-5 w-5" /> {title}</p>
      {r.type === "voucher" ? (
        <p className="mt-2 text-sm text-[#1E2229]">{r.deal_title} · <b>{r.discount_label}</b> · for {r.member_name} · {r.status === "redeemed" ? `used ${fmt(r.redeemed_at)}` : `valid until ${fmt(r.expires_at)}`}</p>
      ) : (
        <p className="mt-2 text-sm text-[#1E2229]">Card {r.member_code} · valid until {fmt(r.expires_at)}. Apply your member offer.</p>
      )}
      {r.type === "voucher" && ok && (
        <button onClick={onRedeem} disabled={busy} data-testid="partner-redeem-btn"
          className="mt-4 rounded-full bg-[#1E2229] px-6 py-3 text-sm font-semibold text-[#FBF8F3] disabled:opacity-60">Mark as redeemed</button>
      )}
    </motion.div>
  );
}

export function PartnerChecker() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async (e) => {
    e?.preventDefault();
    setBusy(true); setErr(""); setRes(null);
    try { const { data } = await api.post("/partner/check", { code }); setRes(data); }
    catch (e2) { setErr(formatErr(e2)); } finally { setBusy(false); }
  };
  const redeem = async () => {
    setBusy(true);
    try { await api.post("/partner/redeem", { code }); toast.success("Voucher redeemed"); await check(); }
    catch (e2) { toast.error(formatErr(e2)); setBusy(false); }
  };

  return (
    <div className="grain relative overflow-hidden rounded-[32px] bg-[#1E2229] p-6 text-[#FBF8F3] sm:p-8" data-testid="partner-checker">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3A72E]">At the counter</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Check a code</h2>
      <p className="mt-1 text-sm text-[#C9CED6]">Type a voucher code (e.g. AB12-CD34) or a member card number (LP-XXXXXX).</p>
      <form onSubmit={check} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ScanLine className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#F3A72E]" />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required minLength={4} placeholder="AB12-CD34"
            data-testid="partner-code-input"
            className="h-14 w-full rounded-full border border-white/20 bg-white/5 pl-12 pr-4 font-mono text-lg tracking-[0.15em] text-[#FBF8F3] outline-none placeholder:text-[#818C9C] focus:border-[#F3A72E]" />
        </div>
        <button disabled={busy} data-testid="partner-check-btn" className="h-14 rounded-full bg-[#D95329] px-8 font-semibold transition-colors hover:bg-[#B63F18] disabled:opacity-60">
          {busy ? "Checking…" : "Check"}
        </button>
      </form>
      {err && <p className="mt-5 rounded-2xl bg-[#FDF0EC] p-4 text-sm text-[#B63F18]" data-testid="partner-check-error">{err}</p>}
      {res && <Result r={res} onRedeem={redeem} busy={busy} />}
    </div>
  );
}
