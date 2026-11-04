import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { DataTable, fmtDate, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { GiftCreator } from "@/admin/GiftCreator";

const LEN = (m) => (m >= 12 ? "1 year" : `${m} month${m === 1 ? "" : "s"}`);
const STATUS = { unredeemed: ["Unused", "bg-[#E3F0ED] text-[#17434C]"], redeemed: ["Redeemed", "bg-[#EBF3EC] text-[#2F5A3A]"], cancelled: ["Cancelled", "bg-[#FDF0EC] text-[#9A4024]"] };
const copy = (c) => navigator.clipboard?.writeText(c).then(() => toast.success("Code copied"), () => toast.error("Couldn't copy"));

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "unused", label: "Unused", test: (r) => r.status === "unredeemed" },
  { key: "redeemed", label: "Redeemed", test: (r) => r.status === "redeemed" },
  { key: "admin", label: "Made by admin", test: (r) => r.source === "admin" },
  { key: "bought", label: "Bought by members", test: (r) => r.source !== "admin" },
];

const columns = (cancel) => [
  { key: "code", label: "Code", render: (r) => (
    <button onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#E3F0ED] px-2 py-1 font-mono text-xs font-bold text-[#17434C] hover:bg-[#D3ECE7]" data-testid={`gift-code-${r.id}`}>
      {r.code} <Copy className="h-3 w-3" /></button>) },
  { key: "months", label: "Length", value: (r) => LEN(r.months), render: (r) => <span className="whitespace-nowrap">{LEN(r.months)}</span> },
  { key: "source", label: "From", value: (r) => (r.source === "admin" ? "Admin" : `Bought by ${r.created_by}`),
    render: (r) => (r.source === "admin" ? <span>Admin{r.note && <span className="block text-xs text-[#3D5E65]">{r.note}</span>}</span> : <span>Bought by {r.created_by || "a member"}</span>) },
  { key: "recipient", label: "For", value: (r) => `${r.recipient_name} ${r.recipient_email}`.trim(),
    render: (r) => (r.recipient_email ? <span>{r.recipient_name}<span className="block text-xs text-[#3D5E65]">{r.recipient_email}{r.email_sent ? " · emailed" : " · not sent"}</span></span> : <span className="text-[#3D5E65]">Handed out</span>) },
  { key: "status", label: "Status", value: (r) => STATUS[r.status]?.[0] || r.status, render: (r) => (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${STATUS[r.status]?.[1] || ""}`} data-testid={`gift-status-${r.id}`}>{STATUS[r.status]?.[0] || r.status}</span>) },
  { key: "redeemed_by", label: "Redeemed by", value: (r) => r.redeemed_by, render: (r) => (r.redeemed_by ? <span>{r.redeemed_by}<span className="block text-xs text-[#3D5E65]">{fmtDate(r.redeemed_at)}</span></span> : "—") },
  { key: "created_at", label: "Created", value: (r) => r.created_at, render: (r) => <span className="whitespace-nowrap">{fmtDate(r.created_at)}</span> },
  { key: "actions", label: "", render: (r) => (r.status === "unredeemed"
    ? <button onClick={(e) => { e.stopPropagation(); cancel(r); }} className={btn.danger} data-testid={`gift-cancel-${r.id}`}>Cancel</button> : null) },
];

export default function GiftsPage() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get("/admin/gifts").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  const cancel = async (r) => {
    if (!window.confirm(`Cancel ${r.code}? It will stop working straight away.`)) return;
    try { await api.post(`/admin/gifts/${r.code}/cancel`); toast.success("Code cancelled"); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div data-testid="admin-gifts-page">
      <PageHead title="Gift codes" sub="Create free membership codes to give away, and see every gift code, including ones members have bought." />
      <GiftCreator onCreated={load} />
      <DataTable id="gifts" columns={columns(cancel)} rows={rows} filters={FILTERS} exportName="go-perks-gift-codes"
        searchKeys={["code", "recipient_name", "recipient_email", "note", "redeemed_by", "created_by"]} empty="No gift codes yet." />
    </div>
  );
}
