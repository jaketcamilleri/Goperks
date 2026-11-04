import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, catLabel, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DealForm } from "@/components/DealForm";
import { DataTable, Pill, fmtDate, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { useOutletContext } from "react-router-dom";

const FILTERS = [
  { key: "pending", label: "Pending", test: (d) => d.status === "pending" },
  { key: "approved", label: "Live", test: (d) => d.status === "approved" },
  { key: "rejected", label: "Rejected", test: (d) => d.status === "rejected" },
  { key: "all", label: "All", test: () => true },
];

export default function DealsPage() {
  const { refreshCounts } = useOutletContext() || {};
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.get("/admin/deals").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const bulk = async (status) => {
    if (status === "deleted" && !window.confirm(`Delete ${sel.size} deal(s)? This can't be undone.`)) return;
    let note = null;
    if (status === "rejected") {
      const a = window.prompt("Optional: a short reason for the partner (included in their email).", "");
      if (a === null) return;
      note = a.trim() || null;
    }
    try {
      const r = await api.post("/admin/deals/bulk", { ids: [...sel], status, note });
      toast.success(`${r.data?.updated ?? 0} deal(s) ${status}${status !== "deleted" ? " — partners emailed" : ""}`);
      setSel(new Set()); load(); refreshCounts?.();
    } catch (e) { toast.error(formatErr(e)); }
  };
  const save = async (f) => {
    setBusy(true);
    try {
      if (editing === "new") await api.post("/admin/deals", f); else await api.put(`/admin/deals/${editing.id}`, f);
      toast.success("Deal saved"); setEditing(null); load(); refreshCounts?.();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  const columns = [
    { key: "title", label: "Deal", render: (d) => <span className="flex items-center gap-3">{d.image_url ? <img src={d.image_url} alt="" className="h-9 w-12 shrink-0 rounded-md object-cover" /> : <span className="h-9 w-12 shrink-0 rounded-md bg-[#D3ECE7]" />}<span className="font-semibold">{d.title}</span></span> },
    { key: "business_name", label: "Business" },
    { key: "category", label: "Category", value: (d) => catLabel(d.category) },
    { key: "discount_label", label: "Offer" },
    { key: "suburb", label: "Suburb" },
    { key: "status", label: "Status", render: (d) => <Pill s={d.status} /> },
    { key: "created_at", label: "Added", value: (d) => d.created_at, render: (d) => fmtDate(d.created_at) },
  ];

  return (
    <div data-testid="admin-deals-page">
      <PageHead title="Deals" sub="Click a row to edit. Tick rows to approve, reject or delete in bulk.">
        <button onClick={() => setEditing("new")} className={btn.primary} data-testid="admin-new-deal-btn"><Plus className="h-4 w-4" /> New deal</button>
      </PageHead>
      <DataTable id="deals" columns={columns} rows={rows} filters={FILTERS} searchKeys={["title", "business_name", "suburb", "discount_label"]}
        selectable selected={sel} onSelect={setSel} exportName="go-perks-deals" onRowClick={(d) => setEditing(d)}
        bulk={<>
          <button onClick={() => bulk("approved")} className={btn.dark} data-testid="deals-bulk-approve">Approve</button>
          <button onClick={() => bulk("rejected")} className={btn.ghost} data-testid="deals-bulk-reject">Reject</button>
          <button onClick={() => bulk("deleted")} className={btn.danger} data-testid="deals-bulk-delete">Delete</button>
        </>} />
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-[#F3F8F7]" data-lenis-prevent data-testid="admin-deal-dialog">
          <DialogHeader><DialogTitle className="font-display text-2xl">{editing === "new" ? "New deal" : "Edit deal"}</DialogTitle></DialogHeader>
          {editing && <DealForm initial={editing === "new" ? {} : editing} onSubmit={save} busy={busy} submitLabel="Save deal" showFeatured />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
