import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { api, formatErr } from "@/lib/api";
import { DataTable, Pill, fmtDate, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { AddPersonDialog, MemberDialog } from "@/admin/PeopleDialogs";

const memberStatus = (u) => u.membership_status;
const MEMBER_FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "active", label: "Active", test: (u) => memberStatus(u) === "active" },
  { key: "inactive", label: "Not paid", test: (u) => memberStatus(u) === "inactive" },
  { key: "expired", label: "Expired", test: (u) => memberStatus(u) === "expired" },
];
const BIZ_FILTERS = [
  { key: "pending", label: "Waiting", test: (u) => (u.business_status || "pending") === "pending" },
  { key: "approved", label: "Approved", test: (u) => u.business_status === "approved" },
  { key: "rejected", label: "Rejected", test: (u) => u.business_status === "rejected" },
  { key: "all", label: "All", test: () => true },
];

const MEMBER_COLS = [
  { key: "name", label: "Name", render: (u) => <span className="font-semibold">{u.name}</span> },
  { key: "email", label: "Email" },
  { key: "member_code", label: "Card" },
  { key: "membership_status", label: "Status", render: (u) => <Pill s={u.membership_status} /> },
  { key: "membership_expires_at", label: "Valid until", value: (u) => u.membership_expires_at || "", render: (u) => fmtDate(u.membership_expires_at) },
  { key: "redeemed_count", label: "Used", className: "text-right" },
  { key: "created_at", label: "Joined", value: (u) => u.created_at, render: (u) => fmtDate(u.created_at) },
];
const BIZ_COLS = [
  { key: "business_name", label: "Business", render: (u) => <span className="font-semibold">{u.business_name || "—"}</span> },
  { key: "name", label: "Contact" },
  { key: "email", label: "Email" },
  { key: "suburb", label: "Suburb" },
  { key: "phone", label: "Phone" },
  { key: "business_status", label: "Status", value: (u) => u.business_status || "pending", render: (u) => <Pill s={u.business_status || "pending"} /> },
  { key: "profile_complete", label: "Profile", value: (u) => (u.profile_complete ? "complete" : "missing"), render: (u) => (u.profile_complete ? "Complete" : <span className="text-[#7A5310]">Missing</span>) },
  { key: "deal_count", label: "Deals", className: "text-right" },
  { key: "created_at", label: "Applied", value: (u) => u.created_at, render: (u) => fmtDate(u.created_at) },
];

export default function PeoplePage({ role }) {
  const isBiz = role === "business";
  const { refreshCounts } = useOutletContext() || {};
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const load = () => api.get("/admin/users", { params: { role } }).then((r) => {
    const list = Array.isArray(r.data) ? r.data : [];
    setRows(list);
    setEditing((e) => (e ? list.find((u) => u.id === e.id) || null : null));
  }).catch(() => setRows([]));
  useEffect(() => { setRows(null); setSel(new Set()); load(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const bulk = async (status) => {
    let note = null;
    if (status === "rejected") {
      const a = window.prompt("Optional: a short reason (included in their email).", "");
      if (a === null) return;
      note = a.trim() || null;
    }
    try {
      const r = await api.post("/admin/businesses/bulk", { ids: [...sel], status, note });
      toast.success(`${r.data?.updated ?? 0} business(es) ${status} — they've been emailed`);
      setSel(new Set()); load(); refreshCounts?.();
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div data-testid={`admin-${role}-page`}>
      <PageHead title={isBiz ? "Businesses" : "Members"} sub={isBiz ? "Approve applicants, add partners and check their profiles." : "Click a member to edit, make their membership valid or resend their card."}>
        <button onClick={() => setAdding(true)} className={btn.primary} data-testid={`add-${role}-btn`}><UserPlus className="h-4 w-4" /> {isBiz ? "Add business" : "Add customer"}</button>
      </PageHead>
      <DataTable id={isBiz ? "businesses" : "members"} columns={isBiz ? BIZ_COLS : MEMBER_COLS} rows={rows} filters={isBiz ? BIZ_FILTERS : MEMBER_FILTERS}
        searchKeys={isBiz ? ["business_name", "name", "email", "suburb"] : ["name", "email", "member_code"]}
        selectable={isBiz} selected={sel} onSelect={setSel} exportName={isBiz ? "go-perks-businesses" : "go-perks-members"}
        onRowClick={isBiz ? undefined : (u) => setEditing(u)}
        bulk={<>
          <button onClick={() => bulk("approved")} className={btn.dark} data-testid="businesses-bulk-approve">Approve</button>
          <button onClick={() => bulk("rejected")} className={btn.danger} data-testid="businesses-bulk-reject">Reject</button>
        </>} />
      <AddPersonDialog role={role} open={adding} onClose={() => setAdding(false)} onCreated={() => { load(); refreshCounts?.(); }} />
      {editing && <MemberDialog key={editing.id + editing.membership_expires_at + editing.membership_status} member={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
