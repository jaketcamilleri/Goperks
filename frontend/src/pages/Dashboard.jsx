import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { MemberCard } from "@/components/MemberCard";
import { SavingsTracker } from "@/components/SavingsTracker";
import { SavedDeals } from "@/components/SavedDeals";
import { WalletButtons } from "@/components/WalletButtons";
import { RateVisits } from "@/components/RateVisits";
import { BonusMonthsNote } from "@/components/BonusMonthsNote";
import { UserCog } from "lucide-react";

function VoucherRow({ v, onRedeem }) {
  const live = v.status === "active";
  return (
    <li className="flex flex-col gap-4 rounded-[24px] border border-[#C2DEDA] bg-white p-5 sm:flex-row sm:items-center sm:justify-between" data-testid={`voucher-row-${v.id}`}>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#9A4024]">{v.business_name}</p>
        <p className="mt-1 font-display text-xl font-semibold">{v.deal_title}</p>
        <p className="mt-2 font-mono text-2xl font-bold tracking-[0.15em]" data-testid={`voucher-code-${v.id}`}>{v.code}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${live ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#D3ECE7] text-[#3D5E65]"}`}>{v.status}</span>
        {live && (
          <button onClick={() => onRedeem(v.id)} data-testid={`voucher-redeem-${v.id}`}
            className="rounded-full border border-[#17434C] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#17434C] hover:text-[#EAF6F3]">Mark as used</button>
        )}
      </div>
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState([]);
  const [tick, setTick] = useState(0);
  const active = user?.membership_status === "active";

  const load = () => api.get("/me/vouchers").then((r) => setVouchers(Array.isArray(r.data) ? r.data : [])).catch(() => setVouchers([]));
  useEffect(() => { load(); }, []);

  const redeem = async (id) => {
    try { await api.post(`/me/vouchers/${id}/redeem`); toast.success("Enjoy your saving!"); load(); setTick((t) => t + 1); }
    catch (e) { toast.error(formatErr(e)); }
  };

  const exp = user?.membership_expires_at ? new Date(user.membership_expires_at).toLocaleDateString("en-AU", { month: "short", year: "numeric" }) : undefined;

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-8 sm:px-8 lg:pt-12" data-testid="member-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#9A4024]">{active ? "My Go Perks" : "My account"}</p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">Hi, {user?.name?.split(" ")[0]}.</h1>
        </div>
        <Link to="/account" className="inline-flex items-center gap-2 rounded-full border border-[#17434C] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[#17434C] hover:text-[#EAF6F3]" data-testid="dashboard-manage-account-btn">
          <UserCog className="h-4 w-4" /> Manage account
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-5">
          <MemberCard live name={user?.name} code={user?.member_code || "Not active"} expires={exp} status={user?.membership_status} />
          {active ? (
            <>
            <p className="mt-4 text-sm text-[#3D5E65]" data-testid="membership-active-note">Show this card at any partner counter. The moving clock and changing code prove it's live, not a screenshot.</p>
            <WalletButtons />
            </>
          ) : (
            <div className="mt-6 rounded-[24px] bg-[#FDF0EC] p-6" data-testid="membership-inactive-note">
              <p className="font-display text-2xl font-semibold">Your card isn't active yet.</p>
              <p className="mt-2 text-[#3D5E65]">Join for $49/year to unlock every deal in the club.</p>
              <Link to="/join" data-testid="dashboard-join-btn" className="mt-5 inline-flex rounded-full bg-[#B9512E] px-6 py-3 font-semibold text-[#EAF6F3]">Activate membership</Link>
            </div>
          )}
          <BonusMonthsNote user={user} />
          <div className="mt-8"><SavingsTracker refreshKey={tick} /></div>
          <RateVisits refreshKey={tick} />
        </div>
        <div className="min-w-0 lg:col-span-6 lg:col-start-7">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">My vouchers</h2>
            <Link to="/deals" className="text-sm font-semibold text-[#9A4024]" data-testid="dashboard-browse-link">Find more deals →</Link>
          </div>
          {vouchers.length === 0 ? (
            <p className="mt-6 rounded-[24px] border border-dashed border-[#C2DEDA] p-8 text-[#3D5E65]" data-testid="vouchers-empty">No vouchers yet. Open any deal and tap “Get my voucher code”.</p>
          ) : (
            <ul className="mt-6 space-y-4" data-testid="vouchers-list">
              {vouchers.map((v) => <VoucherRow key={v.id} v={v} onRedeem={redeem} />)}
            </ul>
          )}
        </div>
      </div>
      <SavedDeals />
    </div>
  );
}
