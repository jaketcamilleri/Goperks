import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { api } from "@/lib/api";
import { DataTable } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";

const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");
const copy = (c) => navigator.clipboard?.writeText(c).then(() => toast.success("Code copied"), () => toast.error("Couldn't copy"));

const COLUMNS = [
  { key: "name", label: "Member", value: (r) => `${r.name || ""} <${r.email}>`, render: (r) => <span><span className="font-semibold">{r.name || "—"}</span><br /><span className="text-xs text-[#3D5E65]">{r.email}</span></span> },
  { key: "code", label: "Referral code", render: (r) => (
    <button onClick={() => copy(r.code)} className="inline-flex items-center gap-1.5 rounded-md bg-[#E3F0ED] px-2 py-1 font-mono text-xs font-bold text-[#17434C] hover:bg-[#D3ECE7]" data-testid={`referral-code-${r.id}`}>
      {r.code} <Copy className="h-3 w-3" /></button>) },
  { key: "signed_up", label: "Friends signed up", value: (r) => r.signed_up, render: (r) => <span data-testid={`referral-signed-${r.id}`}>{r.signed_up}</span> },
  { key: "paid", label: "Friends paid", value: (r) => r.paid, render: (r) => <span data-testid={`referral-paid-${r.id}`}>{r.paid}</span> },
  { key: "months_earned", label: "Free months earned", value: (r) => r.months_earned, render: (r) => <span className="font-semibold" data-testid={`referral-months-${r.id}`}>{r.months_earned}</span> },
  { key: "referred_by", label: "Referred by", value: (r) => r.referred_by || "", render: (r) => r.referred_by || <span className="text-[#3D5E65]">—</span> },
  { key: "joined_at", label: "Joined", value: (r) => r.joined_at, render: (r) => <span className="whitespace-nowrap font-mono text-xs">{day(r.joined_at)}</span> },
];

const FILTERS = [
  { key: "all", label: "All members", test: () => true },
  { key: "referrers", label: "Have referred", test: (r) => r.signed_up > 0 },
  { key: "referred", label: "Were referred", test: (r) => !!r.referred_by },
];

function Totals({ rows }) {
  const sum = (k) => rows.reduce((n, r) => n + (r[k] || 0), 0);
  const items = [["Friends signed up", sum("signed_up"), "signed"], ["Friends paid", sum("paid"), "paid"], ["Free months given to referrers", sum("months_earned"), "months"]];
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-3" data-testid="referral-totals">
      {items.map(([label, value, id]) => (
        <div key={id} className="rounded-2xl border border-[#D3ECE7] bg-white p-5" data-testid={`referral-total-${id}`}>
          <p className="font-display text-3xl font-semibold">{value}</p><p className="mt-1 text-sm text-[#3D5E65]">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function ReferralsPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/admin/referrals").then((r) => setData(r.data || { members: [] })).catch(() => setData({ members: [] }));
  }, []);
  const rows = data ? (Array.isArray(data.members) ? data.members : []) : null;

  return (
    <div data-testid="admin-referrals-page">
      <PageHead title="Referrals" sub={`Every member's referral code and who they've brought in. Each friend who pays earns both people a free month (up to ${data?.cap ?? 12} a year).`} />
      {rows && <Totals rows={rows} />}
      <DataTable id="referrals" columns={COLUMNS} rows={rows} filters={FILTERS} exportName="go-perks-referrals"
        searchKeys={["name", "email", "code", "referred_by"]} empty="No members yet." />
    </div>
  );
}
