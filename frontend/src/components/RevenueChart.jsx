import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { api } from "@/lib/api";

const label = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-AU", { month: "short", year: "2-digit" });

export const RevenueChart = () => {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/admin/monthly").then((r) => setRows(Array.isArray(r.data) ? r.data.map((d) => ({ ...d, label: label(d.month) })) : [])).catch(() => setRows([]));
  }, []);
  const total = rows.reduce((s, r) => s + (r.revenue || 0), 0);

  return (
    <section className="mt-10 rounded-[28px] border border-[#C2DEDA] bg-white p-5 sm:p-8" data-testid="admin-revenue-chart">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#3D5E65]">Last 6 months</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">Members, gifts & revenue</h2>
        </div>
        <p className="font-display text-3xl font-semibold text-[#B9512E]" data-testid="admin-chart-total">A${Math.round(total)}</p>
      </div>
      <div className="mt-6 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="#E3F0ED" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: "#3D5E65", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="n" allowDecimals={false} tick={{ fill: "#3D5E65", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="r" orientation="right" tick={{ fill: "#9A4024", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
            <Tooltip formatter={(v, n) => (n === "Revenue" ? `A$${v}` : v)} contentStyle={{ borderRadius: 14, border: "1px solid #C2DEDA" }} />
            <Legend wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span style={{ color: "#17434C" }}>{v}</span>} />
            <Bar yAxisId="n" dataKey="members" name="New members" fill="#17434C" radius={[8, 8, 0, 0]} />
            <Bar yAxisId="n" dataKey="gifts" name="Gifts" fill="#7FD1B9" radius={[8, 8, 0, 0]} />
            <Line yAxisId="r" type="monotone" dataKey="revenue" name="Revenue" stroke="#B9512E" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
};
