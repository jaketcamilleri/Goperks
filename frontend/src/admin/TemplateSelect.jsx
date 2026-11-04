import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Dropdown of the saved versions of one pitch ("invite" or "pitch"). */
export function TemplateSelect({ base, value, onChange, testid }) {
  const [opts, setOpts] = useState([]);
  useEffect(() => {
    let live = true;
    api.get("/admin/email-templates").then((r) => { if (live) setOpts((Array.isArray(r.data) ? r.data : []).filter((t) => t.base === base)); }).catch(() => {});
    return () => { live = false; };
  }, [base]);
  if (opts.length < 2) return null;
  return (
    <label className="block text-sm font-semibold">Template
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid}
        className="mt-1 h-10 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm font-normal outline-none focus:border-[#17434C]">
        {opts.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
      </select>
    </label>
  );
}
