import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";

const GOOD = "bg-[#EBF3EC] text-[#2F5A3A]";
const BAD = "bg-[#FDF0EC] text-[#9A4024]";
const NEUTRAL = "bg-[#E3F0ED] text-[#17434C]";
const SYSTEM = "bg-[#FEF4DC] text-[#7A5310]";

const ACTIONS = {
  "deal.approved": ["Approved deal", GOOD], "deal.rejected": ["Rejected deal", BAD], "deal.pending": ["Sent deal back to review", NEUTRAL],
  "deal.created": ["Added deal", GOOD], "deal.edited": ["Edited deal", NEUTRAL], "deal.deleted": ["Deleted deal", BAD],
  "deal.removal_requested": ["Asked to remove deal", NEUTRAL], "deal.removed": ["Took deal off the site", BAD], "deal.removal_declined": ["Kept deal live", GOOD],
  "member.deleted": ["Deleted member account", BAD], "business.deleted": ["Deleted business account", BAD],
  "settings.launch_offer": ["Changed launch offer", NEUTRAL],
  "business.approved": ["Approved business", GOOD], "business.rejected": ["Rejected business", BAD],
  "review.hidden": ["Hid review", BAD], "review.shown": ["Showed review", GOOD],
  "user.created": ["Added account", GOOD], "user.edited": ["Edited account", NEUTRAL],
  "membership.activated": ["Activated membership", GOOD], "membership.expiry": ["Changed membership end", NEUTRAL],
  "membership.deactivated": ["Turned off membership", BAD], "card.resent": ["Re-sent member card", NEUTRAL],
  "password_link.sent": ["Sent password link", NEUTRAL], "staff.removed": ["Removed staff", BAD],
  "reports.sent": ["Sent partner reports", SYSTEM],
  "new_deals.sent": ["Sent new deals emails", SYSTEM],
  "invites.sent": ["Sent member invites", GOOD], "invites.retried": ["Retried member invites", NEUTRAL],
  "pitch.sent": ["Sent partner pitches", GOOD],
  "gift.created": ["Created gift codes", GOOD], "gift.cancelled": ["Cancelled gift code", BAD],
  "settings.reply_to": ["Changed reply inbox", NEUTRAL],
  "invites.followup": ["Sent invite follow-up", GOOD],
};
const labelOf = (a) => ACTIONS[a]?.[0] || a;
const AREA = { deal: "Deal", business: "Business", member: "Member", staff: "Staff", review: "Review", invite: "Invites", prospect: "Prospects", system: "Automatic" };

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "deals", label: "Deals", test: (r) => r.target_type === "deal" },
  { key: "businesses", label: "Businesses", test: (r) => r.target_type === "business" },
  { key: "people", label: "Members & team", test: (r) => ["member", "staff"].includes(r.target_type) },
  { key: "reviews", label: "Reviews", test: (r) => r.target_type === "review" },
  { key: "system", label: "Automatic", test: (r) => r.actor_role === "system" },
];

const when = (iso) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const COLUMNS = [
  { key: "created_at", label: "When", value: (r) => r.created_at, render: (r) => <span className="whitespace-nowrap font-mono text-xs">{when(r.created_at)}</span> },
  { key: "actor_name", label: "Who", value: (r) => r.actor_name, render: (r) => (
    <span><span className="font-semibold">{r.actor_name}</span>{r.actor_role === "staff" && <span className="ml-1 text-xs text-[#3D5E65]">· staff</span>}
      {r.actor_email && <><br /><span className="text-xs text-[#3D5E65]">{r.actor_email}</span></>}</span>) },
  { key: "action_label", label: "Action", render: (r) => (
    <span className={`inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-bold ${ACTIONS[r.action]?.[1] || NEUTRAL}`} data-testid={`activity-action-${r.id}`}>{r.action_label}</span>) },
  { key: "target_label", label: "What", render: (r) => (
    <span><span className="font-semibold">{r.target_label || "—"}</span><br /><span className="text-xs text-[#3D5E65]">{AREA[r.target_type] || r.target_type}</span></span>) },
  { key: "details", label: "Details", className: "max-w-sm", render: (r) => <span className="line-clamp-3 text-[#3D5E65]">{r.details || "—"}</span> },
];

export default function ActivityPage() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get("/admin/activity")
      .then((r) => setRows((Array.isArray(r.data) ? r.data : []).map((x) => ({ ...x, action_label: labelOf(x.action) }))))
      .catch(() => setRows([]));
  }, []);

  return (
    <div data-testid="admin-activity-page">
      <PageHead title="Activity" sub="Every approval, rejection and edit made in the control room, with who did it and when. Newest first." />
      <DataTable id="activity" columns={COLUMNS} rows={rows} filters={FILTERS} exportName="go-perks-activity"
        searchKeys={["actor_name", "actor_email", "action_label", "target_label", "details"]}
        empty="Nothing logged yet. Approvals, rejections and edits will show up here." />
    </div>
  );
}
