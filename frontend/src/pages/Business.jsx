import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, catLabel, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DealForm } from "@/components/DealForm";
import { ScanLine } from "lucide-react";
import { PartnerStats } from "@/components/PartnerStats";
import { PartnerReviews } from "@/components/PartnerReviews";
import { MaskLines, Eyebrow, FadeUp } from "@/components/Reveal";
import { bp, assetUrl } from "@/lib/site";

const STATUS_STYLE = { pending: "bg-[#FEF4DC] text-[#7A5310]", approved: "bg-[#EBF3EC] text-[#2F5A3A]", rejected: "bg-[#FDF0EC] text-[#9A4024]", removed: "bg-[#ECECEC] text-[#3D3D3D]" };

export function StatusPill({ status }) {
  return <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[status] || ""}`} data-testid="deal-status-pill">{status}</span>;
}

function Pitch() {
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <FadeUp>
        <p className="max-w-lg text-[#3D5E65] md:text-lg">Put your business in front of local families who are actively looking for somewhere to go this weekend. It's free to list — you choose the offer.</p>
        <ul className="mt-8 space-y-4">
          {["Create a free partner account", "Submit your deal in two minutes", "We review it and put it live for members"].map((s, i) => (
            <li key={s} className="flex items-center gap-4"><span className="font-display text-3xl italic text-[#B9512E]">0{i + 1}</span><span className="text-lg">{s}</span></li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to={bp("/register")} data-testid="business-register-btn" className="rounded-full bg-[#B9512E] px-7 py-4 text-center font-semibold text-[#EAF6F3]">Create partner account</Link>
          <Link to={bp("/login")} data-testid="business-login-btn" className="rounded-full border border-[#17434C] px-7 py-4 text-center font-semibold">Partner log in</Link>
        </div>
      </FadeUp>
      <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80" alt="Local shop interior" className="aspect-[4/3] w-full rounded-[32px] object-cover" />
    </div>
  );
}

function ProfilePrompt({ user }) {
  return (
    <div className="mt-12 max-w-2xl rounded-[28px] border border-[#C2DEDA] bg-white p-8" data-testid="business-profile-required">
      <p className="font-display text-3xl font-semibold">You're approved — welcome!</p>
      <p className="mt-3 text-[#3D5E65]">Before you add deals, tell members about {user.business_name || "your business"}: your address, phone, opening hours, logo and a short description. It takes about two minutes.</p>
      <Link to={bp("/profile")} data-testid="business-complete-profile-btn" className="mt-6 inline-flex rounded-full bg-[#B9512E] px-7 py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-95">Complete my profile</Link>
    </div>
  );
}

function ProfileCard({ user }) {
  return (
    <Link to={bp("/profile")} data-testid="business-profile-link"
      className="mt-6 flex items-center justify-between gap-4 rounded-[24px] border border-[#C2DEDA] bg-white p-5 transition-colors hover:border-[#17434C]">
      <span className="flex min-w-0 items-center gap-4">
        {user.logo_url && <img src={assetUrl(user.logo_url)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain" />}
        <span className="min-w-0"><span className="block font-display text-xl font-semibold">Business profile</span><span className="block truncate text-sm text-[#3D5E65]">{[user.address, user.suburb].filter(Boolean).join(", ")}</span></span>
      </span>
      <span className="shrink-0 rounded-full border border-[#17434C] px-5 py-2.5 text-sm font-semibold">Edit</span>
    </Link>
  );
}

export default function Business() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const isPartner = user && (user.role === "admin" || (user.role === "business" && user.business_status === "approved" && user.profile_complete));
  const awaiting = user && user.role === "business" && user.business_status !== "approved";
  const needsProfile = user && user.role === "business" && user.business_status === "approved" && !user.profile_complete;

  const load = () => api.get("/business/deals").then((r) => setMine(Array.isArray(r.data) ? r.data : [])).catch(() => setMine([]));
  useEffect(() => { if (isPartner) load(); }, [isPartner]);

  const submit = async (f) => {
    setBusy(true);
    try {
      await api.post("/business/deals", f);
      toast.success("Deal submitted — we'll review it shortly");
      setFormKey((k) => k + 1);
      load();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  const requestRemoval = async (d) => {
    const reason = window.prompt(`Why should "${d.title}" come down? The Go Perks team will review your request. Your deal stays live until then.`, "");
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error("Please add a short reason"); return; }
    try {
      await api.post(`/business/deals/${d.id}/removal-request`, { reason: reason.trim() });
      toast.success("Removal requested — we'll be in touch");
      load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8" data-testid="business-portal">
      <Eyebrow>For local businesses</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
        lines={[<>Share a deal,</>, <em key="x" className="font-normal italic text-[#B9512E]">fill your tables.</em>]} />
      {awaiting ? (
        <div className="pop mt-12 max-w-2xl rounded-[28px] border-2 border-[#17434C] bg-[#FFF4CE] p-8" data-testid="business-awaiting-approval">
          {user.business_status === "rejected" ? (
            <>
              <p className="font-display text-3xl font-semibold">Application not approved</p>
              <p className="mt-3 text-[#3D5E65]">Sorry, we couldn't approve {user.business_name || "your business"} as a partner this time. Check your email for details.</p>
            </>
          ) : (
            <>
              <p className="font-display text-3xl font-semibold">Thanks — you're on the list!</p>
              <p className="mt-3 text-[#3D5E65]">We review every new partner before they go live. We'll email you as soon as {user.business_name || "your business"} is approved, with your partner kit and window sticker.</p>
            </>
          )}
        </div>
      ) : needsProfile ? <ProfilePrompt user={user} /> : !isPartner ? <Pitch /> : (
        <>
        <Link to={bp("/redeem")} data-testid="open-redeem-page-btn"
          className="pop pop-hover relative mt-12 flex flex-col gap-4 overflow-hidden rounded-[32px] border-[3px] border-[#17434C] bg-[#17434C] p-6 text-[#EAF6F3] sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <span className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#FFD166] text-[#17434C]"><ScanLine className="h-8 w-8" /></span>
            <span><span className="block font-mono text-xs uppercase tracking-[0.2em] text-[#FFD166]">At the counter</span>
              <span className="mt-1 block font-display text-3xl font-semibold">Redeem a deal</span>
              <span className="text-sm text-[#BFD9D6]">Scan a member's card or voucher and see today's redemptions.</span></span>
          </span>
          <span className="shrink-0 rounded-full border-2 border-[#EAF6F3] bg-[#B9512E] px-6 py-3 text-center font-bold">Open scanner</span>
        </Link>
        {user.role === "business" && <ProfileCard user={user} />}
        <Link to={bp("/sticker")} data-testid="sticker-link"
          className="mt-6 flex items-center justify-between gap-4 rounded-[24px] border-2 border-[#17434C] bg-[#F0EAFF] p-5 transition-shadow hover:shadow-[4px_4px_0_#17434C]">
          <span><span className="block font-display text-xl font-semibold">Window sticker</span><span className="text-sm text-[#3D5E65]">Print a "Go Perks members save here" sticker for your door or counter.</span></span>
          <span className="shrink-0 rounded-full bg-[#7054CB] px-5 py-2.5 text-sm font-semibold text-white">Get sticker</span>
        </Link>
        <PartnerStats />
        {user.role === "business" && <PartnerReviews />}
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <div className="pop rounded-[32px] border-2 border-[#17434C] bg-white p-6 sm:p-8 lg:col-span-7" data-testid="business-deal-submit-form">
            <h2 className="font-display text-2xl font-semibold">Submit a new deal</h2>
            <p className="mt-1 text-sm text-[#3D5E65]">Submissions go to our team for approval before going live.</p>
            <div className="mt-6"><DealForm key={formKey} initial={{ suburb: user.suburb || "" }} lockedBusiness={user.business_name || user.name} onSubmit={submit} busy={busy} /></div>
          </div>
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-semibold">Your submissions</h2>
            {mine.length === 0 ? <p className="mt-4 text-[#3D5E65]" data-testid="business-empty">Nothing submitted yet.</p> : (
              <ul className="mt-4 space-y-3" data-testid="business-submissions">
                {mine.map((d) => (
                  <li key={d.id} className="rounded-2xl border border-[#C2DEDA] bg-white p-4" data-testid={`business-deal-${d.id}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="font-semibold">{d.title}</p><p className="text-sm text-[#3D5E65]">{catLabel(d.category)} · {d.discount_label}</p></div>
                      <StatusPill status={d.status} />
                    </div>
                    {d.status === "approved" && (d.removal_requested_at
                      ? <p className="mt-3 rounded-xl bg-[#FFE3EC] px-3 py-2 text-sm font-semibold text-[#750B35]" data-testid={`business-deal-removal-pending-${d.id}`}>Removal requested — the Go Perks team is reviewing it. It stays live until then.</p>
                      : <button onClick={() => requestRemoval(d)} className="mt-3 rounded-full border-2 border-[#17434C] px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-[#FFE3EC]" data-testid={`business-deal-request-removal-${d.id}`}>Request removal</button>)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
