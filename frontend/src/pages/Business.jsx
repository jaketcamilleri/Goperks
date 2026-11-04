import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api, catLabel, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DealForm } from "@/components/DealForm";
import { PartnerChecker } from "@/components/PartnerChecker";
import { PartnerStats } from "@/components/PartnerStats";
import { MaskLines, Eyebrow, FadeUp } from "@/components/Reveal";

const STATUS_STYLE = { pending: "bg-[#FEF4DC] text-[#7A5310]", approved: "bg-[#EBF3EC] text-[#2F5A3A]", rejected: "bg-[#FDF0EC] text-[#B63F18]" };

export function StatusPill({ status }) {
  return <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${STATUS_STYLE[status] || ""}`} data-testid="deal-status-pill">{status}</span>;
}

function Pitch() {
  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-2">
      <FadeUp>
        <p className="max-w-lg text-[#525B68] md:text-lg">Put your business in front of local families who are actively looking for somewhere to go this weekend. It's free to list — you choose the offer.</p>
        <ul className="mt-8 space-y-4">
          {["Create a free partner account", "Submit your deal in two minutes", "We review it and put it live for members"].map((s, i) => (
            <li key={s} className="flex items-center gap-4"><span className="font-display text-3xl italic text-[#D95329]">0{i + 1}</span><span className="text-lg">{s}</span></li>
          ))}
        </ul>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/register?role=business&next=/business" data-testid="business-register-btn" className="rounded-full bg-[#D95329] px-7 py-4 text-center font-semibold text-[#FBF8F3]">Create partner account</Link>
          <Link to="/login?next=/business" data-testid="business-login-btn" className="rounded-full border border-[#1E2229] px-7 py-4 text-center font-semibold">Partner log in</Link>
        </div>
      </FadeUp>
      <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80" alt="Local shop interior" className="aspect-[4/3] w-full rounded-[32px] object-cover" />
    </div>
  );
}

export default function Business() {
  const { user } = useAuth();
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const isPartner = user && (user.role === "business" || user.role === "admin");

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

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8" data-testid="business-portal">
      <Eyebrow>For local businesses</Eyebrow>
      <MaskLines as="h1" className="mt-5 font-display text-5xl font-semibold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl"
        lines={[<>Share a deal,</>, <em key="x" className="font-normal italic text-[#D95329]">fill your tables.</em>]} />
      {!isPartner ? <Pitch /> : (
        <>
        <div className="mt-12"><PartnerChecker /></div>
        <PartnerStats />
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <div className="rounded-[32px] border border-[#E0D7C3] bg-white p-6 sm:p-8 lg:col-span-7" data-testid="business-deal-submit-form">
            <h2 className="font-display text-2xl font-semibold">Submit a new deal</h2>
            <p className="mt-1 text-sm text-[#525B68]">Submissions go to our team for approval before going live.</p>
            <div className="mt-6"><DealForm key={formKey} initial={{ business_name: user.business_name || "" }} onSubmit={submit} busy={busy} /></div>
          </div>
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-semibold">Your submissions</h2>
            {mine.length === 0 ? <p className="mt-4 text-[#525B68]" data-testid="business-empty">Nothing submitted yet.</p> : (
              <ul className="mt-4 space-y-3" data-testid="business-submissions">
                {mine.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E0D7C3] bg-white p-4" data-testid={`business-deal-${d.id}`}>
                    <div><p className="font-semibold">{d.title}</p><p className="text-sm text-[#525B68]">{catLabel(d.category)} · {d.discount_label}</p></div>
                    <StatusPill status={d.status} />
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
