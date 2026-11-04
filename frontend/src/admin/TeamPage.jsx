import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DataTable, Pill, fmtDate, btn } from "@/admin/DataTable";
import { PageHead } from "@/admin/AdminShell";
import { AddPersonDialog } from "@/admin/PeopleDialogs";

export default function TeamPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [adding, setAdding] = useState(false);
  const load = () => api.get("/admin/users", { params: { role: "team" } }).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const remove = async (u) => {
    if (!window.confirm(`Remove ${u.name}? They'll lose access straight away.`)) return;
    try { await api.delete(`/admin/team/${u.id}`); toast.success("Staff member removed"); load(); } catch (e) { toast.error(formatErr(e)); }
  };
  const resend = async (u) => {
    try { await api.post(`/admin/users/${u.id}/password-link`); toast.success("Password link sent"); } catch (e) { toast.error(formatErr(e)); }
  };

  const columns = [
    { key: "name", label: "Name", render: (u) => <span className="font-semibold">{u.name}{u.id === user?.id && <span className="ml-1 text-xs text-[#3D5E65]">(you)</span>}</span> },
    { key: "email", label: "Email" },
    { key: "role", label: "Access", value: (u) => (u.role === "admin" ? "owner" : "staff"), render: (u) => <Pill s={u.role === "admin" ? "owner" : "staff"} /> },
    { key: "created_at", label: "Added", value: (u) => u.created_at, render: (u) => fmtDate(u.created_at) },
    { key: "actions", label: "", csv: false, render: (u) => (u.role === "staff" ? (
      <span className="flex justify-end gap-2">
        <button onClick={() => resend(u)} className={btn.ghost} data-testid={`team-password-link-${u.id}`}>Send password link</button>
        <button onClick={() => remove(u)} className={btn.danger} data-testid={`team-remove-${u.id}`}>Remove</button>
      </span>) : null) },
  ];

  return (
    <div data-testid="admin-team-page">
      <PageHead title="Team" sub="Staff can approve deals and businesses and check codes, but can't see revenue, payments or members.">
        <button onClick={() => setAdding(true)} className={btn.primary} data-testid="add-staff-btn"><UserPlus className="h-4 w-4" /> Add staff</button>
      </PageHead>
      <DataTable id="team" columns={columns} rows={rows} searchKeys={["name", "email"]} empty="No team members yet." />
      <AddPersonDialog role="staff" open={adding} onClose={() => setAdding(false)} onCreated={load} />
    </div>
  );
}
