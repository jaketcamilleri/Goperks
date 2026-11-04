import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ScanLine, CheckCircle2, XCircle, Camera } from "lucide-react";
import { CameraScanner } from "@/components/CameraScanner";
import { api, formatErr } from "@/lib/api";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU") : "—");

function CardDeals({ deals, onRedeemCard, busy }) {
  const list = Array.isArray(deals) ? deals : [];
  if (!list.length) return <p className="mt-3 text-sm text-[#17434C]">You have no live deals to redeem yet.</p>;
  return (
    <ul className="mt-4 space-y-2" data-testid="card-deal-list">
      {list.map((d) => (
        <li key={d.deal_id} className="flex flex-col gap-2 rounded-xl bg-white/80 p-3 text-[#17434C] sm:flex-row sm:items-center sm:justify-between" data-testid={`card-deal-${d.deal_id}`}>
          <span className="text-sm"><b>{d.title}</b> · {d.discount_label}</span>
          {d.used_this_term ? (
            <span className="text-xs font-semibold text-[#9A4024]" data-testid={`card-deal-used-${d.deal_id}`}>Used {fmt(d.used_at)} — once per year</span>
          ) : (
            <button onClick={() => onRedeemCard(d.deal_id)} disabled={busy} data-testid={`card-deal-redeem-${d.deal_id}`}
              className="rounded-full bg-[#17434C] px-4 py-2 text-xs font-semibold text-[#EAF6F3] disabled:opacity-60">Redeem this deal</button>
          )}
        </li>
      ))}
    </ul>
  );
}

function Result({ r, onRedeem, onRedeemCard, busy }) {
  const ok = r.status === "active";
  const Icon = ok ? CheckCircle2 : XCircle;
  const title = r.type === "member"
    ? ok ? `${r.member_name}'s membership is active` : `${r.member_name}'s membership is ${r.status}`
    : ok ? "Valid voucher" : `Voucher ${r.status}`;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className={`mt-5 rounded-2xl p-5 ${ok ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#FDF0EC] text-[#9A4024]"}`} data-testid="partner-check-result">
      <p className="flex items-center gap-2 font-display text-xl font-semibold" data-testid="partner-check-status"><Icon className="h-5 w-5" /> {title}</p>
      {r.type === "voucher" ? (
        <p className="mt-2 text-sm text-[#17434C]">{r.deal_title} · <b>{r.discount_label}</b> · for {r.member_name} · {r.status === "redeemed" ? `used ${fmt(r.redeemed_at)}` : `valid until ${fmt(r.expires_at)}`}</p>
      ) : (
        <p className="mt-2 text-sm text-[#17434C]">Card {r.member_code} · valid until {fmt(r.expires_at)}. {ok ? "Pick the deal they're using:" : ""}</p>
      )}
      {r.type === "member" && ok && <CardDeals deals={r.deals} onRedeemCard={onRedeemCard} busy={busy} />}
      {r.type === "voucher" && ok && (
        <button onClick={onRedeem} disabled={busy} data-testid="partner-redeem-btn"
          className="mt-4 rounded-full bg-[#17434C] px-6 py-3 text-sm font-semibold text-[#EAF6F3] disabled:opacity-60">Mark as redeemed</button>
      )}
    </motion.div>
  );
}

export function PartnerChecker() {
  const [code, setCode] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);

  const checkCode = async (value) => {
    setBusy(true); setErr(""); setRes(null);
    try { const { data } = await api.post("/partner/check", { code: value }); setRes(data); }
    catch (e2) { setErr(formatErr(e2)); } finally { setBusy(false); }
  };
  const check = async (e) => {
    e?.preventDefault();
    await checkCode(code);
  };
  const onScan = useCallback((value) => {
    setCamera(false);
    setCode(value);
    checkCode(value);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const redeem = async () => {
    setBusy(true);
    try { await api.post("/partner/redeem", { code }); toast.success("Voucher redeemed"); await check(); }
    catch (e2) { toast.error(formatErr(e2)); setBusy(false); }
  };
  const redeemCard = async (dealId) => {
    setBusy(true);
    try { await api.post("/partner/redeem-card", { member_code: code, deal_id: dealId }); toast.success("Deal redeemed on member card"); await check(); }
    catch (e2) { toast.error(formatErr(e2)); setBusy(false); }
  };

  return (
    <div className="grain relative overflow-hidden rounded-[32px] bg-[#17434C] p-6 text-[#EAF6F3] sm:p-8" data-testid="partner-checker">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">At the counter</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Check a code</h2>
      <p className="mt-1 text-sm text-[#BFD9D6]">Scan the QR on their phone, or type a voucher code (e.g. AB12-CD34) or member card number (LP-XXXXXX).</p>
      <form onSubmit={check} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <ScanLine className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#EE8A63]" />
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required minLength={4} placeholder="AB12-CD34"
            data-testid="partner-code-input"
            className="h-14 w-full rounded-full border border-white/20 bg-white/5 pl-12 pr-4 font-mono text-lg tracking-[0.15em] text-[#EAF6F3] outline-none placeholder:text-[#8FAFAD] focus:border-[#EE8A63]" />
        </div>
        <button disabled={busy} data-testid="partner-check-btn" className="h-14 rounded-full bg-[#B9512E] px-8 font-semibold transition-colors hover:bg-[#9A4024] disabled:opacity-60">
          {busy ? "Checking…" : "Check"}
        </button>
        <button type="button" onClick={() => { setRes(null); setErr(""); setCamera(!camera); }} data-testid="partner-scan-btn"
          className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/30 px-6 font-semibold transition-colors hover:bg-white/10">
          <Camera className="h-5 w-5" /> {camera ? "Stop" : "Scan"}
        </button>
      </form>
      {camera && <CameraScanner onScan={onScan} onClose={() => setCamera(false)} />}
      {err && <p className="mt-5 rounded-2xl bg-[#FDF0EC] p-4 text-sm text-[#9A4024]" data-testid="partner-check-error">{err}</p>}
      {res && <Result r={res} onRedeem={redeem} onRedeemCard={redeemCard} busy={busy} />}
    </div>
  );
}
