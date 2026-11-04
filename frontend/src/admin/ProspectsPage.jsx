import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, List, Map as MapIcon, Plus, Send } from "lucide-react";
import { api, formatErr, catLabel } from "@/lib/api";
import { DataTable, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { ProspectDialog, STATUSES } from "@/admin/ProspectDialog";
import { PitchDialog } from "@/admin/PitchDialog";
import { ProspectsMap } from "@/admin/ProspectsMap";
import { FollowUpPanel } from "@/admin/FollowUpPanel";

const TONE = { new: "bg-[#E3F0ED] text-[#17434C]", contacted: "bg-[#FEF4DC] text-[#7A5310]", interested: "bg-[#EBF3EC] text-[#2F5A3A]",
  joined: "bg-[#17434C] text-white", not_interested: "bg-[#FDF0EC] text-[#9A4024]" };
const LABEL = Object.fromEntries(STATUSES);
const stop = (e) => e.stopPropagation();
const PITCH = { sent: "Pitch sent", queued: "Pitch sending", failed: "Pitch not sent" };

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "chase", label: "Chase up", test: (r) => r.follow_up },
  ...STATUSES.map(([k, l]) => ({ key: k, label: l, test: (r) => r.status === k })),
];

function StatusCell({ row, onChange }) {
  return (
    <div>
      <select value={row.status} onClick={stop} onChange={(e) => onChange(row, e.target.value)} aria-label="Status"
        className={`h-8 rounded-md border-0 px-2 text-xs font-bold outline-none ${TONE[row.status]}`} data-testid={`prospect-status-${row.id}`}>
        {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {row.pitch_status && <p className={`mt-1 text-[11px] ${row.pitch_status === "failed" ? "text-[#9A4024]" : "text-[#3D5E65]"}`} title={row.pitch_error || ""} data-testid={`prospect-pitch-${row.id}`}>{PITCH[row.pitch_status]}</p>}
    </div>
  );
}

const copy = (e, email) => {
  stop(e);
  navigator.clipboard?.writeText(email).then(() => toast.success("Email copied"), () => toast.error("Couldn't copy"));
};

export default function ProspectsPage() {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(undefined);
  const [view, setView] = useState("list");
  const [selected, setSelected] = useState(new Set());
  const [pitching, setPitching] = useState(null);
  const load = useCallback(() => api.get("/admin/prospects")
    .then((r) => setRows(Array.isArray(r.data) ? r.data.map((x) => ({ ...x, type: catLabel(x.category), state: LABEL[x.status] })) : []))
    .catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!rows?.some((r) => r.pitch_status === "queued")) return undefined;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
  }, [rows, load]);

  const setStatus = async (row, status) => {
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, status, state: LABEL[status] } : r)));
    try {
      const { data } = await api.patch(`/admin/prospects/${row.id}`, { status });
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...data, type: r.type, state: LABEL[data.status] } : r)));
    } catch (e) { toast.error(formatErr(e)); load(); }
  };

  const columns = [
    { key: "business_name", label: "Business", render: (r) => (
      <span><span className="font-semibold">{r.business_name}</span>
        {r.website && <><br /><a href={r.website} target="_blank" rel="noreferrer" onClick={stop} className="text-xs text-[#9A4024] hover:underline">{r.website.replace(/^https?:\/\/(www\.)?/, "")}</a></>}</span>) },
    { key: "type", label: "Type" },
    { key: "suburb", label: "Suburb", value: (r) => `${r.suburb} ${r.postcode}`, render: (r) => (
      <span>{r.suburb} <span className="font-mono text-xs text-[#3D5E65]">{r.postcode}</span>{r.address && <><br /><span className="text-xs text-[#3D5E65]">{r.address}</span></>}</span>) },
    { key: "email", label: "Email", render: (r) => r.email ? (
      <span className="inline-flex items-center gap-1.5"><span className="font-mono text-xs">{r.email}</span>
        <button onClick={(e) => copy(e, r.email)} aria-label="Copy email" className="rounded p-1 text-[#3D5E65] hover:bg-[#EAF6F3]" data-testid={`prospect-copy-${r.id}`}><Copy className="h-3.5 w-3.5" /></button></span>) : "—" },
    { key: "phone", label: "Phone", render: (r) => <span className="whitespace-nowrap text-xs">{r.phone || "—"}</span> },
    { key: "state", label: "Status", render: (r) => <StatusCell row={r} onChange={setStatus} /> },
    { key: "notes", label: "Notes", className: "max-w-[14rem]", render: (r) => <span className="line-clamp-2 text-xs text-[#3D5E65]">{r.notes || "—"}</span> },
    { key: "source_url", label: "Email found on", render: (r) => <span className="text-xs text-[#3D5E65]">{r.source_url?.startsWith("http") ? new URL(r.source_url).hostname.replace(/^www\./, "") : r.source_url || "—"}</span> },
  ];
  const all = rows || [];
  const toggle = (
    <div className="inline-flex rounded-lg border border-[#D7E7E4] bg-white p-0.5" data-testid="prospects-view-toggle">
      {[["list", List, "List"], ["map", MapIcon, "Map"]].map(([k, Icon, l]) => (
        <button key={k} onClick={() => setView(k)} data-testid={`prospects-view-${k}`}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition-colors ${view === k ? "bg-[#17434C] text-white" : "text-[#3D5E65] hover:bg-[#EAF6F3]"}`}><Icon className="h-4 w-4" />{l}</button>
      ))}
    </div>
  );

  return (
    <div data-testid="admin-prospects-page">
      <PageHead title="Prospects" sub="Local businesses in Melbourne's west that could join as partners. Emails are the ones each business lists publicly. Pitches only go out when you choose businesses and press send.">
        {toggle}
        <button onClick={() => setOpen(null)} className={btn.primary} data-testid="prospect-add-btn"><Plus className="h-4 w-4" /> Add prospect</button>
      </PageHead>
      <FollowUpPanel prospects={all} onStatus={setStatus} onOpen={setOpen} />
      {view === "map" ? <ProspectsMap prospects={all} labels={LABEL} onOpen={setOpen} /> : (
        <DataTable id="prospects" columns={columns} rows={rows} filters={FILTERS} onRowClick={(r) => setOpen(r)} exportName="go-perks-prospects"
          selectable selected={selected} onSelect={setSelected}
          bulk={<button onClick={() => setPitching(all.filter((r) => selected.has(r.id)))} className={btn.dark} data-testid="prospects-bulk-pitch"><Send className="h-4 w-4" /> Send partner pitch</button>}
          searchKeys={["business_name", "type", "suburb", "postcode", "address", "email", "phone", "notes", "state"]} empty="No prospects here." />
      )}
      {open !== undefined && <ProspectDialog key={open?.id || "new"} prospect={open} onClose={() => setOpen(undefined)} onSaved={load} />}
      {pitching && <PitchDialog prospects={pitching} onClose={() => { setPitching(null); setSelected(new Set()); }} onSent={load} />}
    </div>
  );
}
