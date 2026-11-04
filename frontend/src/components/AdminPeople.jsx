import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, X, Search } from "lucide-react";
import { api, formatErr } from "@/lib/api";

const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU") : "—");
const PILL = {
  approved: "bg-[#EBF3EC] text-[#2F5A3A]", active: "bg-[#EBF3EC] text-[#2F5A3A]",
  pending: "bg-[#FEF4DC] text-[#7A5310]", rejected: "bg-[#FDF0EC] text-[#9A4024]",
  expired: "bg-[#FDF0EC] text-[#9A4024]", inactive: "bg-[#D3ECE7] text-[#3D5E65]",
};
const Pill = ({ s }) => <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${PILL[s] || PILL.inactive}`}>{s}</span>;

export function AdminPeople({ role, onChange }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(role === "business" ? "pending" : "all");

  const load = () => api.get("/admin/users", { params: { role } }).then((r) => setRows(Array.isArray(r.data) ? r.data : [])).catch(() => setRows([]));
  useEffect(() => { setRows(null); setFilter(role === "business" ? "pending" : "all"); load(); }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (u, status) => {
    let note = "";
    if (status === "rejected") {
      const a = window.prompt(`Optional: reason for declining ${u.business_name || u.name} (included in their email).`, "");
      if (a === null) return;
      note = a.trim();
    }
    try {
      await api.post(`/admin/businesses/${u.id}/status`, { status, note: note || null });
      toast.success(status === "approved" ? "Business approved — partner kit emailed" : "Business declined — they've been emailed");
      load(); onChange?.();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const status = (u) => (role === "business" ? u.business_status || "pending" : u.membership_status);
  const filters = role === "business" ? ["pending", "approved", "rejected", "all"] : ["all", "active", "inactive", "expired"];
  const list = (rows || []).filter((u) => (filter === "all" || status(u) === filter) &&
    `${u.name} ${u.email} ${u.business_name || ""} ${u.member_code || ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <section className="mt-10" data-testid={`admin-${role}-section`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} data-testid={`admin-${role}-filter-${f}`}
              className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${filter === f ? "bg-[#17434C] text-[#EAF6F3]" : "border border-[#C2DEDA] bg-white"}`}>{f}</button>
          ))}
        </div>
        <label className="relative block w-full md:ml-auto md:w-72">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3D5E65]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" data-testid={`admin-${role}-search`}
            className="h-11 w-full rounded-full border border-[#C2DEDA] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#17434C]" />
        </label>
      </div>
      {rows === null ? <p className="mt-6 font-mono text-sm">Loading…</p> : list.length === 0 ? (
        <p className="mt-6 text-[#3D5E65]" data-testid={`admin-${role}-empty`}>Nothing here.</p>
      ) : (
        <ul className="mt-6 space-y-3" data-testid={`admin-${role}-list`}>
          {list.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 rounded-[20px] border border-[#C2DEDA] bg-white p-4 sm:flex-row sm:items-center" data-testid={`admin-user-${u.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{role === "business" ? u.business_name || u.name : u.name}</p>
                <p className="truncate text-sm text-[#3D5E65]">
                  {role === "business" ? `${u.name} · ` : ""}{u.email} · joined {fmt(u.created_at)}
                  {role === "business" ? ` · ${u.deal_count ?? 0} deals` : ` · ${u.member_code || "no card"} · ${u.redeemed_count ?? 0} used`}
                  {role !== "business" && u.membership_expires_at ? ` · until ${fmt(u.membership_expires_at)}` : ""}
                </p>
                {role === "business" && u.business_status === "approved" && (
                  <p className="truncate text-sm text-[#3D5E65]" data-testid={`admin-biz-profile-${u.id}`}>
                    {u.profile_complete ? [u.address && `${u.address}, ${u.suburb}`, u.phone, u.website?.replace(/^https?:\/\//, ""), u.instagram && `@${u.instagram}`].filter(Boolean).join(" · ")
                      : <span className="font-semibold text-[#7A5310]">Profile not completed yet</span>}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Pill s={status(u)} />
                {role === "business" && status(u) !== "approved" && (
                  <button onClick={() => decide(u, "approved")} aria-label="Approve business" data-testid={`admin-biz-approve-${u.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-[#4E7A58] text-white"><Check className="h-4 w-4" /></button>
                )}
                {role === "business" && status(u) !== "rejected" && (
                  <button onClick={() => decide(u, "rejected")} aria-label="Decline business" data-testid={`admin-biz-reject-${u.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-[#FDF0EC] text-[#9A4024]"><X className="h-4 w-4" /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
