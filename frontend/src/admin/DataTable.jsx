import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search } from "lucide-react";

const csvCell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCsv(name, columns, rows) {
  const cols = columns.filter((c) => c.csv !== false);
  const lines = [cols.map((c) => csvCell(c.label)).join(",")]
    .concat(rows.map((r) => cols.map((c) => csvCell(c.value ? c.value(r) : r[c.key])).join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${name}-${new Date().toISOString().slice(0, 10)}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * columns: [{ key, label, value?(row) -> sortable/exportable value, render?(row), className?, csv? }]
 * filters: [{ key, label, test(row) }]
 */
export function DataTable({ id, columns, rows, filters, searchKeys, selectable = false, selected, onSelect, actions, bulk, exportName, onRowClick, empty = "Nothing here yet." }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(filters?.[0]?.key);
  const [sort, setSort] = useState(null);
  const all = Array.isArray(rows) ? rows : [];

  const list = useMemo(() => {
    const f = filters?.find((x) => x.key === filter);
    let out = all.filter((r) => (!f || f.test(r)) && (!q || searchKeys.map((k) => r[k] ?? "").join(" ").toLowerCase().includes(q.toLowerCase())));
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const val = (r) => (col.value ? col.value(r) : r[col.key]) ?? "";
      out = [...out].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * (sort.dir === "asc" ? 1 : -1));
    }
    return out;
  }, [all, filter, filters, q, searchKeys, sort, columns]);

  const ids = list.map((r) => r.id);
  const allOn = selectable && ids.length > 0 && ids.every((i) => selected.has(i));
  const toggleAll = () => onSelect(allOn ? new Set() : new Set(ids));
  const toggle = (i) => { const s = new Set(selected); s.has(i) ? s.delete(i) : s.add(i); onSelect(s); };
  const sortBy = (k) => setSort((s) => (s?.key === k ? (s.dir === "asc" ? { key: k, dir: "desc" } : null) : { key: k, dir: "asc" }));

  return (
    <div className="rounded-2xl border border-[#D7E7E4] bg-white" data-testid={`${id}-table`}>
      <div className="flex flex-col gap-3 border-b border-[#E3F0ED] p-3 lg:flex-row lg:items-center">
        {filters && (
          <div className="flex gap-1 overflow-x-auto" data-testid={`${id}-filters`}>
            {filters.map((f) => {
              const n = all.filter(f.test).length;
              return (
                <button key={f.key} onClick={() => { setFilter(f.key); onSelect?.(new Set()); }} data-testid={`${id}-filter-${f.key}`}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${filter === f.key ? "bg-[#17434C] text-white" : "text-[#3D5E65] hover:bg-[#EAF6F3]"}`}>
                  {f.label} <span className="ml-1 font-mono text-xs opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-1 items-center gap-2 lg:justify-end">
          <label className="relative block min-w-0 flex-1 lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#3D5E65]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" data-testid={`${id}-search`}
              className="h-9 w-full rounded-lg border border-[#D7E7E4] bg-[#F7FBFA] pl-9 pr-3 text-sm outline-none focus:border-[#17434C]" />
          </label>
          {exportName && (
            <button onClick={() => downloadCsv(exportName, columns, list)} data-testid={`${id}-export`}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#D7E7E4] px-3 text-sm font-semibold hover:bg-[#EAF6F3]">
              <Download className="h-4 w-4" /> CSV
            </button>
          )}
          {actions}
        </div>
      </div>
      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#E3F0ED] bg-[#FEF4DC] px-3 py-2 text-sm" data-testid={`${id}-bulk-bar`}>
          <span className="font-semibold">{selected.size} selected</span>
          {bulk}
          <button onClick={() => onSelect(new Set())} className="ml-auto text-[#3D5E65] hover:underline">Clear</button>
        </div>
      )}
      {columns.length > 8 && <p className="px-3 pt-2 text-xs text-[#3D5E65]" data-testid={`${id}-scroll-hint`}>Scroll sideways to see all columns →</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[#F7FBFA] text-[11px] uppercase tracking-wider text-[#3D5E65]">
            <tr>
              {selectable && <th className="w-10 px-3 py-2.5"><input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all" className="h-4 w-4 accent-[#17434C]" data-testid={`${id}-select-all`} /></th>}
              {columns.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 font-semibold ${c.className || ""}`}>
                  <button onClick={() => sortBy(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-[#17434C]" data-testid={`${id}-sort-${c.key}`}>
                    {c.label}{sort?.key === c.key && (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF5F3]">
            {rows === null ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center font-mono text-xs text-[#3D5E65]">Loading…</td></tr>
            ) : list.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-3 py-10 text-center text-[#3D5E65]" data-testid={`${id}-empty`}>{empty}</td></tr>
            ) : list.map((r) => (
              <tr key={r.id} onClick={onRowClick ? () => onRowClick(r) : undefined} data-testid={`${id}-row-${r.id}`}
                className={`transition-colors hover:bg-[#F7FBFA] ${onRowClick ? "cursor-pointer" : ""} ${selected?.has(r.id) ? "bg-[#EAF6F3]" : ""}`}>
                {selectable && <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select row" className="h-4 w-4 accent-[#17434C]" data-testid={`${id}-select-${r.id}`} /></td>}
                {columns.map((c) => <td key={c.key} className={`px-3 py-2.5 align-middle ${c.className || ""}`}>{c.render ? c.render(r) : r[c.key] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[#E3F0ED] px-3 py-2 text-xs text-[#3D5E65]" data-testid={`${id}-count`}>{list.length} of {all.length}</p>
    </div>
  );
}

const PILL = {
  approved: "bg-[#EBF3EC] text-[#2F5A3A]", active: "bg-[#EBF3EC] text-[#2F5A3A]", paid: "bg-[#EBF3EC] text-[#2F5A3A]", redeemed: "bg-[#EBF3EC] text-[#2F5A3A]",
  pending: "bg-[#FEF4DC] text-[#7A5310]", initiated: "bg-[#FEF4DC] text-[#7A5310]", unredeemed: "bg-[#FEF4DC] text-[#7A5310]",
  rejected: "bg-[#FDF0EC] text-[#9A4024]", expired: "bg-[#FDF0EC] text-[#9A4024]", failed: "bg-[#FDF0EC] text-[#9A4024]", refunded: "bg-[#FDF0EC] text-[#9A4024]",
};
export const Pill = ({ s }) => <span className={`inline-block rounded-md px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${PILL[s] || "bg-[#E3F0ED] text-[#3D5E65]"}`}>{s || "—"}</span>;

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "—");

export const btn = {
  primary: "inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#B9512E] px-3 text-sm font-semibold text-white transition-colors hover:bg-[#9A4024] disabled:opacity-60",
  dark: "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#17434C] px-3 text-sm font-semibold text-white hover:bg-[#0F3138] disabled:opacity-60",
  ghost: "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm font-semibold hover:bg-[#EAF6F3] disabled:opacity-60",
  danger: "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FDF0EC] px-3 text-sm font-semibold text-[#9A4024] hover:bg-[#F8DDD3] disabled:opacity-60",
};
