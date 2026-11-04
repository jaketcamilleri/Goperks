import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MapPin, ArrowLeft, Copy, Ticket, Timer } from "lucide-react";
import { api, catLabel, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { HeartButton } from "@/components/HeartButton";
import { QRCodeSVG } from "qrcode.react";
import { PartnerCard } from "@/components/PartnerCard";
import { Reviews } from "@/components/Reviews";
import { RatingChip } from "@/components/Stars";
import { endsLabel, isFavourite } from "@/lib/deals";

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

  const loadDeal = () => api.get(`/deals/${id}`).then((r) => setDeal(r.data)).catch(() => setDeal(false));
  useEffect(() => { loadDeal(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-6 sm:px-8 lg:pt-10" data-testid="deal-detail-container">
      <Link to="/deals" className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#9A4024]" data-testid="deal-back-link"><ArrowLeft className="h-4 w-4" /> All deals</Link>
      <div className="mt-6 grid gap-10 lg:grid-cols-12">
        <div className="relative aspect-[16/10] overflow-hidden rounded-3xl bg-[#D3ECE7] lg:col-span-7 lg:aspect-[4/3]">
          {deal.image_url ? <img src={deal.image_url} alt={deal.title} className="h-full w-full object-cover" />
            : <div className="grid h-full w-full place-items-center bg-[#17434C] p-8 text-center font-display text-4xl font-semibold text-[#EAF6F3]">{deal.business_name}</div>}
          <span className="absolute left-4 top-4 rounded-full bg-[#B9512E] px-4 py-1.5 text-lg font-bold text-white shadow">{deal.discount_label}</span>
          <HeartButton dealId={deal.id} className="absolute right-4 top-4" />
        </div>
        <div className="lg:col-span-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">{catLabel(deal.category)}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl" data-testid="deal-title">{deal.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[#3D5E65]"><span className="font-semibold text-[#17434C]">{deal.business_name}</span>{deal.suburb && <> · <MapPin className="h-4 w-4" /> {deal.suburb}</>}</p>
          <a href="#reviews" className="mt-3 inline-flex flex-wrap items-center gap-2" data-testid="deal-rating-link">
            <RatingChip deal={deal} testId="deal-detail-rating" />
            {isFavourite(deal) && <span className="rounded-md bg-[#E8F2EA] px-2 py-0.5 text-[11px] font-bold text-[#2F5A3A]">Member favourite</span>}
          </a>
          {deal.ended ? <p className="mt-4 rounded-xl bg-[#FDF0EC] px-4 py-3 text-sm font-semibold text-[#9A4024]" data-testid="deal-ended">This deal has ended.</p>
            : endsLabel(deal) && <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#FDF0EC] px-3 py-2 text-sm font-semibold text-[#9A4024]" data-testid="deal-ends"><Timer className="h-4 w-4" /> {endsLabel(deal)}</p>}
          <p className="mt-5 text-base leading-relaxed md:text-lg">{deal.description}</p>
          {deal.terms && (
            <div className="mt-6 rounded-2xl border border-[#C2DEDA] bg-white p-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#9A4024]">Terms</p>
              <p className="mt-2 text-sm text-[#3D5E65]">{deal.terms}</p>
            </div>
          )}
          <div className="mt-8">
            {voucher ? <VoucherTicket v={voucher} /> : deal.ended ? null : used ? (
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
          <PartnerCard p={deal.partner} />
        </div>
      </div>
      <Reviews dealId={deal.id} onChange={loadDeal} />
    </div>
  );
}
