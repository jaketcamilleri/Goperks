import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Pencil, Trash2, Plus } from "lucide-react";
import { api, catLabel, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DealForm } from "@/components/DealForm";
import { StatusPill } from "@/pages/Business";
import { Eyebrow } from "@/components/Reveal";

const TABS = ["pending", "approved", "rejected"];

function Stat({ label, value, id }) {
  return (
    <div className="rounded-[24px] border border-[#E0D7C3] bg-white p-5" data-testid={`admin-stat-${id}`}>
      <p className="font-mono text-[11px] uppercase tracking-widest text-[#525B68]">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold">{value ?? "—"}</p>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("pending");
  const [deals, setDeals] = useState([]);
  const [stats, setStats] = useState({});
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    api.get("/admin/deals", { params: { status: tab } }).then((r) => setDeals(Array.isArray(r.data) ? r.data : [])).catch(() => setDeals([]));
    api.get("/admin/stats").then((r) => setStats(r.data || {})).catch(() => {});
  };
  useEffect(() => { load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (id, status) => {
    try { await api.post(`/admin/deals/${id}/status`, { status }); toast.success(`Deal ${status}`); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this deal?")) return;
    await api.delete(`/admin/deals/${id}`).catch(() => {});
    load();
  };
  const save = async (f) => {
    setBusy(true);
    try {
      if (editing === "new") await api.post("/admin/deals", f);
      else await api.put(`/admin/deals/${editing.id}`, f);
      toast.success("Deal saved");
      setEditing(null);
      load();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-5 pb-28 pt-14 sm:px-8" data-testid="admin-deal-approval-panel">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>Admin</Eyebrow>
          <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">Club control room</h1>
        </div>
        <button onClick={() => setEditing("new")} data-testid="admin-new-deal-btn" className="inline-flex items-center gap-2 rounded-full bg-[#D95329] px-6 py-3 font-semibold text-[#FBF8F3]">
          <Plus className="h-4 w-4" /> New deal
        </button>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Stat id="members" label="Members" value={stats.members} />
        <Stat id="active" label="Active" value={stats.active_members} />
        <Stat id="businesses" label="Businesses" value={stats.businesses} />
        <Stat id="pending" label="Pending" value={stats.pending_deals} />
        <Stat id="live" label="Live deals" value={stats.live_deals} />
        <Stat id="vouchers" label="Vouchers" value={stats.vouchers} />
      </div>
      <div className="mt-12 flex gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold capitalize ${tab === t ? "bg-[#1E2229] text-[#FBF8F3]" : "border border-[#E0D7C3] bg-white"}`}>{t}</button>
        ))}
      </div>
      {deals.length === 0 ? <p className="mt-8 text-[#525B68]" data-testid="admin-empty">No {tab} deals.</p> : (
        <ul className="mt-8 space-y-3" data-testid="admin-deal-list">
          {deals.map((d) => (
            <li key={d.id} className="flex flex-col gap-4 rounded-[24px] border border-[#E0D7C3] bg-white p-4 sm:flex-row sm:items-center" data-testid={`admin-deal-${d.id}`}>
              {d.image_url ? <img src={d.image_url} alt="" className="h-20 w-full rounded-xl object-cover sm:w-28" /> : <div className="h-20 w-28 rounded-xl bg-[#F3EDE2]" />}
              <div className="flex-1">
                <p className="font-display text-lg font-semibold">{d.title}</p>
                <p className="text-sm text-[#525B68]">{d.business_name} · {catLabel(d.category)} · {d.suburb} · <span className="font-semibold">{d.discount_label}</span></p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={d.status} />
                {d.status !== "approved" && <button onClick={() => setStatus(d.id, "approved")} aria-label="Approve" data-testid={`admin-approve-${d.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-[#4E7A58] text-white"><Check className="h-4 w-4" /></button>}
                {d.status !== "rejected" && <button onClick={() => setStatus(d.id, "rejected")} aria-label="Reject" data-testid={`admin-reject-${d.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-[#FDF0EC] text-[#B63F18]"><X className="h-4 w-4" /></button>}
                <button onClick={() => setEditing(d)} aria-label="Edit" data-testid={`admin-edit-${d.id}`} className="grid h-10 w-10 place-items-center rounded-full border border-[#E0D7C3]"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(d.id)} aria-label="Delete" data-testid={`admin-delete-${d.id}`} className="grid h-10 w-10 place-items-center rounded-full border border-[#E0D7C3]"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-[#FBF8F3]" data-lenis-prevent data-testid="admin-deal-dialog">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing === "new" ? "New deal" : "Edit deal"}</DialogTitle></DialogHeader>
          {editing && <DealForm initial={editing === "new" ? {} : editing} onSubmit={save} busy={busy} submitLabel="Save deal" showFeatured />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
