import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";
import { TemplateSelect } from "@/admin/TemplateSelect";
import { OwnEmailDrafts } from "@/admin/OwnEmailDrafts";

/** A nudge after the first invite, for invited people who still haven't signed up. Sent from the owner's own email. */
export function FollowUpComposer({ onSent }) {
  const [count, setCount] = useState(null);
  const [tpl, setTpl] = useState("invite_followup");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const loadCount = useCallback(() => api.get("/admin/invites/followup").then((r) => setCount(r.data?.count ?? 0)).catch(() => setCount(0)), []);
  useEffect(() => { loadCount(); }, [loadCount]);

  const prepare = async () => {
    setBusy(true);
    try { const { data } = await api.post("/admin/invites/followup", { note, template: tpl }); setResult({ ...data }); }
    catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };
  const markSent = (d) => api.post("/admin/invites/followup-sent", { email: d.to }).then(() => { onSent?.(); loadCount(); })
    .catch((e) => toast.error(formatErr(e)));

  return (
    <section className="mb-8 rounded-2xl border border-[#D3ECE7] bg-white p-5" data-testid="followup-composer">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><BellRing className="h-5 w-5 text-[#B9512E]" /> Follow-up nudge</h2>
      <p className="mt-1 text-sm text-[#3D5E65]" data-testid="followup-count">
        {count === null ? "Checking…" : count === 0 ? "Everyone you invited has either joined or already had a follow-up." :
          `${count} ${count === 1 ? "person has" : "people have"} been invited but haven't signed up yet. Send them a friendly reminder, once.`}
      </p>
      {!result && count > 0 && (
        <div className="mt-4 space-y-3">
          <TemplateSelect base="invite_followup" value={tpl} onChange={setTpl} testid="followup-template-select" />
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Optional personal note" data-testid="followup-note-input"
            className="w-full rounded-lg border border-[#D7E7E4] p-3 text-sm outline-none focus:border-[#17434C]" />
          <button onClick={prepare} disabled={busy} className={btn.primary} data-testid="followup-write-btn">{busy ? "Getting them ready…" : `Write ${count} follow-up${count === 1 ? "" : "s"}`}</button>
        </div>
      )}
      {result && <div className="mt-4"><OwnEmailDrafts drafts={result.drafts} onSent={markSent} /></div>}
    </section>
  );
}
