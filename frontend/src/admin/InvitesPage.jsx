import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, fmtDate } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { InviteComposer } from "@/admin/InviteComposer";
import { FollowUpComposer } from "@/admin/FollowUpComposer";

const stateOf = (r) => (r.member ? "member" : r.joined ? "joined" : r.unsubscribed ? "unsubscribed" : r.status);
const TONE = {
  member: "bg-[#EBF3EC] text-[#2F5A3A]", joined: "bg-[#EBF3EC] text-[#2F5A3A]", sent: "bg-[#E3F0ED] text-[#17434C]",
  queued: "bg-[#FEF4DC] text-[#7A5310]", failed: "bg-[#FDF0EC] text-[#9A4024]", unsubscribed: "bg-[#FDF0EC] text-[#9A4024]",
};
const LABEL = { member: "Joined · member", joined: "Joined", sent: "Sent", queued: "Sending", failed: "Not sent", unsubscribed: "Unsubscribed" };

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "sent", label: "Sent", test: (r) => r.status === "sent" },
  { key: "joined", label: "Joined", test: (r) => r.joined },
  { key: "failed", label: "Not sent", test: (r) => r.status === "failed" },
  { key: "unsubscribed", label: "Unsubscribed", test: (r) => r.unsubscribed },
];

const COLUMNS = [
  { key: "email", label: "Email", render: (r) => <span className="font-semibold">{r.email}</span> },
  { key: "name", label: "Name" },
  { key: "state", label: "Status", value: (r) => LABEL[r.state], render: (r) => (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${TONE[r.state] || TONE.sent}`} data-testid={`invite-status-${r.id}`}>{LABEL[r.state] || r.state}</span>) },
  { key: "error", label: "Problem", className: "max-w-xs", render: (r) => <span className="text-xs text-[#9A4024]">{r.status === "failed" ? r.error : "—"}</span> },
  { key: "sent_at", label: "Sent", value: (r) => r.sent_at || r.created_at, render: (r) => fmtDate(r.sent_at || r.created_at) },
  { key: "followed_up_at", label: "Follow-up", value: (r) => r.followed_up_at || "", render: (r) => (r.followed_up_at ? fmtDate(r.followed_up_at) : "—") },
];

export default function InvitesPage() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => api.get("/admin/invites").then((r) => setRows(Array.isArray(r.data) ? r.data.map((x) => ({ ...x, state: stateOf(x) })) : [])).catch(() => setRows([])), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div data-testid="admin-invites-page">
      <PageHead title="Member invites" sub="Send customers our ready-made 'join Go Perks' invite from your own email. People who already have an account, were already invited or asked not to be contacted are skipped." />
      <InviteComposer onSent={load} />
      <FollowUpComposer onSent={load} />
      <DataTable id="invites" columns={COLUMNS} rows={rows} filters={FILTERS} searchKeys={["email", "name", "state"]} exportName="go-perks-invites" empty="No invites sent yet." />
    </div>
  );
}
