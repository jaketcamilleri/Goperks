import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { DataTable, fmtDate, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { Stars } from "@/components/Stars";

const FILTERS = [
  { key: "visible", label: "Showing", test: (r) => !r.hidden },
  { key: "low", label: "1\u20132 stars", test: (r) => r.rating <= 2 },
  { key: "hidden", label: "Hidden", test: (r) => r.hidden },
  { key: "all", label: "All", test: () => true },
];

export default function ReviewsPage() {
  const [rows, setRows] = useState(null);
  const load = () => api.get("/admin/reviews").then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const toggle = async (r) => {
    try { await api.post(`/admin/reviews/${r.id}/hide`, { hidden: !r.hidden }); toast.success(r.hidden ? "Review is showing again" : "Review hidden"); load(); }
    catch (e) { toast.error(formatErr(e)); }
  };

  const columns = [
    { key: "created_at", label: "Date", value: (r) => r.created_at, render: (r) => fmtDate(r.created_at) },
    { key: "deal_title", label: "Deal", render: (r) => <span><span className="font-semibold">{r.deal_title}</span><br /><span className="text-xs text-[#3D5E65]">{r.business_name}</span></span> },
    { key: "name", label: "Member" },
    { key: "rating", label: "Stars", render: (r) => <Stars value={r.rating} size="h-3.5 w-3.5" /> },
    { key: "comment", label: "Comment", className: "max-w-sm", render: (r) => <span className="line-clamp-3">{r.comment || "\u2014"}</span> },
    { key: "hidden", label: "", csv: false, render: (r) => (
      <button onClick={() => toggle(r)} className={r.hidden ? btn.ghost : btn.danger} data-testid={`review-toggle-${r.id}`}>{r.hidden ? "Show" : "Hide"}</button>) },
  ];

  return (
    <div data-testid="admin-reviews-page">
      <PageHead title="Reviews" sub="Members can review a deal after they've used it. Hide anything rude or off-topic; the deal's rating updates straight away." />
      <DataTable id="reviews" columns={columns} rows={rows} filters={FILTERS} searchKeys={["deal_title", "business_name", "name", "comment"]} exportName="go-perks-reviews" empty="No reviews yet." />
    </div>
  );
}
