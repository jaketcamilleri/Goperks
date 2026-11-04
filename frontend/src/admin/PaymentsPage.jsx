import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataTable, Pill, fmtDate } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { PartnerChecker } from "@/components/PartnerChecker";

const FILTERS = [
  { key: "paid", label: "Paid", test: (p) => p.payment_status === "paid" },
  { key: "gift", label: "Gifts", test: (p) => p.kind === "gift" },
  { key: "other", label: "Unfinished", test: (p) => p.payment_status !== "paid" },
  { key: "all", label: "All", test: () => true },
];

const COLS = [
  { key: "created_at", label: "Date", value: (p) => p.created_at, render: (p) => fmtDate(p.created_at) },
  { key: "email", label: "Buyer" },
  { key: "kind", label: "Type", render: (p) => <span className="capitalize">{p.kind}</span> },
  { key: "amount", label: "Amount", className: "text-right", value: (p) => p.amount, render: (p) => `A$${Number(p.amount || 0).toFixed(2)}` },
  { key: "payment_status", label: "Payment", render: (p) => <Pill s={p.payment_status} /> },
  { key: "gift_to", label: "Gift for", value: (p) => (p.kind === "gift" ? `${p.gift_name || ""} <${p.gift_email || ""}>` : ""), render: (p) => (p.kind === "gift" ? <span>{p.gift_name}<br /><span className="text-xs text-[#3D5E65]">{p.gift_email}</span></span> : "—") },
  { key: "gift_code", label: "Gift code", value: (p) => p.gift?.code || "", render: (p) => (p.gift ? <span className="font-mono text-xs">{p.gift.code}</span> : "—") },
  { key: "gift_status", label: "Gift status", value: (p) => p.gift?.status || "", render: (p) => (p.gift ? <span><Pill s={p.gift.status} />{!p.gift.email_sent && <span className="ml-1 text-xs text-[#3D5E65]">sends {p.gift.send_on}</span>}</span> : "—") },
];

export function PaymentsPage() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    api.get("/admin/payments").then((r) => setRows((Array.isArray(r.data) ? r.data : []).map((p) => ({ ...p, id: p.session_id })))).catch(() => setRows([]));
  }, []);
  return (
    <div data-testid="admin-payments-page">
      <PageHead title="Payments" sub="Every membership and gift checkout, newest first." />
      <DataTable id="payments" columns={COLS} rows={rows} filters={FILTERS} searchKeys={["email", "gift_name", "gift_email"]} exportName="go-perks-payments" empty="No payments yet." />
    </div>
  );
}

export function CheckPage() {
  return (
    <div data-testid="admin-check-page">
      <PageHead title="Check a code" sub="Look up any voucher code or member card, and redeem it if needed." />
      <PartnerChecker />
    </div>
  );
}
