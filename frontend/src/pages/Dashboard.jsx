import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MemberCard } from "@/components/MemberCard";
import { MaskLines, Eyebrow } from "@/components/Reveal";

function VoucherRow({ v, onRedeem }) {
  const live = v.status === "active";
  return (
    <li className="flex flex-col gap-4 rounded-[24px] border border-[#E0D7C3] bg-white p-5 sm:flex-row sm:items-center sm:justify-between" data-testid={`voucher-row-${v.id}`}>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#B63F18]">{v.business_name}</p>
        <p className="mt-1 font-display text-xl font-semibold">{v.deal_title}</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-[0.15em]" data-testid={`voucher-code-${v.id}`}>{v.code}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${live ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#F3EDE2] text-[#525B68]"}`}>{v.status}</span>
        {live && (
          <button onClick={() => onRedeem(v.id)} data-testid={`voucher-redeem-${v.id}`}
            className="rounded-full border border-[#1E2229] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#1E2229] hover:text-[#FBF8F3]">Mark as used</button>
        )}
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const active = user?.membership_status === "active";

  const load = () => api.get("/me/vouchers").then((r) => setVouchers(Array.isArray(r.data) ? r.data : [])).catch(() => setVouchers([]));
  useEffect(() => { load(); }, []);

  const redeem = async (id) => {
    try { await api.post(`/me/vouchers/${id}/redeem`); toast.success("Enjoy your saving!"); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };

  const exp = user?.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8" data-testid="member-dashboard">
      <Eyebrow>My account</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl"
        lines={[<>Hi, <em className="font-normal italic text-[#D95329]">{user?.name?.split(" ")[0]}</em>.</>]} />
      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <MemberCard name={user?.name} code={user?.member_code || "Not active"} expires={exp} status={user?.membership_status} />
          {active ? (
            <p className="mt-5 text-sm text-[#525B68]" data-testid="membership-active-note">Show this card at any partner counter. Tilt it — it's alive.</p>
          ) : (
            <div className="mt-6 rounded-[24px] bg-[#FDF0EC] p-6" data-testid="membership-inactive-note">
              <p className="font-display text-2xl font-semibold">Your card isn't active yet.</p>
              <p className="mt-2 text-[#525B68]">Join for $49/year to unlock every deal in the club.</p>
              <Link to="/join" data-testid="dashboard-join-btn" className="mt-5 inline-flex rounded-full bg-[#D95329] px-6 py-3 font-semibold text-[#FBF8F3]">Activate membership</Link>
            </div>
          )}
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-3xl font-semibold">My vouchers</h2>
            <Link to="/deals" className="text-sm font-semibold text-[#B63F18]" data-testid="dashboard-browse-link">Find more deals →</Link>
          </div>
          {vouchers.length === 0 ? (
            <p className="mt-6 rounded-[24px] border border-dashed border-[#E0D7C3] p-8 text-[#525B68]" data-testid="vouchers-empty">No vouchers yet. Open any deal and tap “Get my voucher code”.</p>
          ) : (
            <ul className="mt-6 space-y-4" data-testid="vouchers-list">
              {vouchers.map((v) => <VoucherRow key={v.id} v={v} onRedeem={redeem} />)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
