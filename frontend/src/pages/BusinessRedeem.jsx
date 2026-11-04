import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ScanLine, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { BizLink } from "@/lib/site";
import { PartnerChecker } from "@/components/PartnerChecker";

const time = (iso) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });

function Success({ info, onNext }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-[32px] bg-[#2F5A3A] p-8 text-center text-[#EBF3EC] sm:p-12" data-testid="redeem-success">
      <CheckCircle2 className="mx-auto h-16 w-16" />
      <p className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Redeemed</p>
      <p className="mt-3 text-lg" data-testid="redeem-success-detail">
        <b>{info?.member_name || "Member"}</b> · {info?.deal_title}{info?.discount_label ? ` · ${info.discount_label}` : ""}
      </p>
      <p className="mt-1 text-sm opacity-80">{new Date().toLocaleString("en-AU", { weekday: "long", hour: "numeric", minute: "2-digit" })}</p>
      <button onClick={onNext} autoFocus className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#EBF3EC] px-8 py-4 font-semibold text-[#2F5A3A] transition-transform active:scale-95" data-testid="redeem-scan-next-btn">
        <ScanLine className="h-5 w-5" /> Scan next member
      </button>
    </motion.div>
  );
}

function TodayList({ rows }) {
  return (
    <section className="mt-10" data-testid="redeem-today">
      <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><Clock className="h-5 w-5 text-[#B9512E]" /> Redeemed today <span className="text-base font-normal text-[#3D5E65]">({rows?.length ?? 0})</span></h2>
      {!rows?.length ? <p className="mt-3 text-sm text-[#3D5E65]" data-testid="redeem-today-empty">Nothing redeemed yet today.</p> : (
        <ul className="mt-3 divide-y divide-[#E3F0ED] rounded-2xl border border-[#C2DEDA] bg-white px-4" data-testid="redeem-today-list">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm" data-testid={`redeem-today-${r.id}`}>
              <span className="min-w-0"><b>{r.member_name}</b> · <span className="text-[#3D5E65]">{r.deal_title}</span></span>
              <span className="shrink-0 font-mono text-xs text-[#3D5E65]">{time(r.redeemed_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Counter screen for businesses: scan a member's card or voucher, redeem, see today's redemptions. */
export default function BusinessRedeem() {
  const [done, setDone] = useState(null);
  const [round, setRound] = useState(0);
  const [today, setToday] = useState(null);
  const load = useCallback(() => api.get("/partner/redemptions/today").then((r) => setToday(Array.isArray(r.data) ? r.data : [])).catch(() => setToday([])), []);
  useEffect(() => { load(); }, [load]);

  const redeemed = (info) => { setDone(info); load(); };
  const next = () => { setDone(null); setRound((n) => n + 1); };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8 lg:pt-12" data-testid="business-redeem-page">
      <BizLink className="text-sm font-semibold text-[#9A4024]" data-testid="redeem-back-portal">← Business portal</BizLink>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Redeem a deal</h1>
      <p className="mt-2 text-[#3D5E65]">Scan the member's live card or voucher QR, check it's active, then pick the deal they're using. Only your own deals show up.</p>
      <div className="mt-8">
        {done ? <Success info={done} onNext={next} /> : <PartnerChecker key={round} autoCamera={round > 0} onRedeemed={redeemed} title="Scan member card" />}
      </div>
      <TodayList rows={today} />
    </div>
  );
}
