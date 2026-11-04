import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MapPin, ArrowLeft, Copy, Ticket } from "lucide-react";
import { api, catLabel, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Eyebrow } from "@/components/Reveal";
import { HeartButton } from "@/components/HeartButton";
import { QRCodeSVG } from "qrcode.react";

export function VoucherTicket({ v }) {
  const copy = () => { navigator.clipboard?.writeText(v.code); toast.success("Voucher code copied"); };
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 140, damping: 16 }}
      className="ticket-edge overflow-hidden rounded-[24px] bg-[#17434C] text-[#EAF6F3]" data-testid="voucher-ticket">
      <div className="flex items-center justify-between p-6">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#EE8A63]">Member voucher</span>
        <span className="font-display text-xl font-semibold">{v.discount_label}</span>
      </div>
      <div className="mx-6 border-t-2 border-dashed border-white/20" />
      <div className="p-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#BFD9D6]">Show this code at the counter</p>
        <button onClick={copy} data-testid="voucher-code" className="mt-2 flex items-center gap-3 font-mono text-3xl font-bold tracking-[0.15em] text-[#EAF6F3] sm:text-4xl">
          {v.code} <Copy className="h-5 w-5 text-[#EE8A63]" />
        </button>
        <p className="mt-3 text-sm text-[#BFD9D6]">{v.business_name} · valid until {new Date(v.expires_at).toLocaleDateString("en-AU")}</p>
        <div className="mt-5 w-fit rounded-2xl bg-white p-3" data-testid="voucher-qr">
          <QRCodeSVG value={v.code} size={140} level="M" fgColor="#17434C" />
        </div>
      </div>
    </motion.div>
  );
}

export default function DealDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [deal, setDeal] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [busy, setBusy] = useState(false);
  const [used, setUsed] = useState(null);

  useEffect(() => {
    api.get(`/deals/${id}`).then((r) => setDeal(r.data)).catch(() => setDeal(false));
  }, [id]);

  useEffect(() => {
    if (!user) { setUsed(null); return; }
    api.get(`/deals/${id}/my-status`).then((r) => {
      if (r.data?.active_voucher && !r.data?.used_this_term) setVoucher(r.data.active_voucher);
      setUsed(r.data?.used_this_term ? r.data.used_at : null);
    }).catch(() => setUsed(null));
  }, [id, user]);

  const claim = async () => {
    if (!user) return nav(`/login?next=/deals/${id}`);
    if (user.membership_status !== "active" && user.role !== "admin") return nav("/join");
    setBusy(true);
    try {
      const { data } = await api.post(`/deals/${id}/voucher`);
      setVoucher(data);
      toast.success("Voucher ready — show it at the counter");
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setBusy(false);
    }
  };

  if (deal === null) return <p className="px-8 py-24 font-mono text-sm">Loading…</p>;
  if (!deal) return <p className="px-8 py-24 font-display text-2xl" data-testid="deal-not-found">Deal not found.</p>;

  const label = !user ? "Log in to claim" : user.membership_status === "active" || user.role === "admin" ? "Get my voucher code" : "Join to unlock this deal";

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-10 sm:px-8" data-testid="deal-detail-container">
      <Link to="/deals" className="inline-flex items-center gap-2 text-sm font-semibold" data-testid="deal-back-link"><ArrowLeft className="h-4 w-4" /> All deals</Link>
      <div className="mt-8 grid gap-12 lg:grid-cols-12">
        <motion.div initial={{ clipPath: "inset(0 0 100% 0 round 32px)" }} animate={{ clipPath: "inset(0 0 0% 0 round 32px)" }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-[4/3] overflow-hidden lg:col-span-7">
          <img src={deal.image_url} alt={deal.title} className="h-full w-full object-cover" />
          <span className="absolute left-5 top-5 rotate-[-4deg] rounded-full bg-[#EE8A63] px-5 py-2 font-display text-2xl font-semibold">{deal.discount_label}</span>
          <HeartButton dealId={deal.id} className="absolute right-5 top-5" />
        </motion.div>
        <div className="lg:col-span-5">
          <Eyebrow>{catLabel(deal.category)}</Eyebrow>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl" data-testid="deal-title">{deal.title}</h1>
          <p className="mt-4 flex items-center gap-2 text-[#3D5E65]"><span className="font-semibold text-[#17434C]">{deal.business_name}</span> · <MapPin className="h-4 w-4" /> {deal.suburb}</p>
          <p className="mt-6 text-base leading-relaxed md:text-lg">{deal.description}</p>
          {deal.terms && (
            <div className="mt-6 rounded-2xl border border-[#C2DEDA] bg-white p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#9A4024]">Terms</p>
              <p className="mt-2 text-sm text-[#3D5E65]">{deal.terms}</p>
            </div>
          )}
          <div className="mt-8">
            {voucher ? <VoucherTicket v={voucher} /> : used ? (
              <div className="rounded-[24px] border border-dashed border-[#C2DEDA] bg-white p-6" data-testid="deal-used-this-term">
                <p className="font-display text-2xl font-semibold">You've used this deal this year</p>
                <p className="mt-2 text-sm text-[#3D5E65]">Redeemed on {new Date(used).toLocaleDateString("en-AU")}. Each deal is one use per membership year — it unlocks again when you renew.</p>
              </div>
            ) : (
              <button onClick={claim} disabled={busy} data-testid="claim-voucher-btn"
                className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#B9512E] py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60">
                <Ticket className="h-5 w-5" /> {busy ? "Generating…" : label}
              </button>
            )}
            <p className="mt-4 text-sm text-[#3D5E65]" data-testid="deal-once-per-term-note">One use per member, per membership year.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
