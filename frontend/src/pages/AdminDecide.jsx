import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "@/components/Reveal";
import { ap } from "@/lib/site";

const DONE = { approved: "Approved — they've been emailed their partner kit.", rejected: "Rejected — they've been emailed your decision." };

function Applicant({ biz }) {
  return (
    <div className="mt-8 rounded-[24px] border border-[#C2DEDA] bg-white p-6" data-testid="decide-applicant">
      <p className="font-display text-2xl font-semibold" data-testid="decide-business-name">{biz.business_name || "Unnamed business"}</p>
      <p className="mt-2 text-[#3D5E65]" data-testid="decide-contact">{biz.name} · {biz.email}</p>
    </div>
  );
}

export default function AdminDecide() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [action, setAction] = useState(params.get("action") === "reject" ? "reject" : "approve");
  const [biz, setBiz] = useState(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/decision", { params: { token } }).then((r) => setBiz(r.data || null)).catch((e) => setErr(formatErr(e)));
  }, [token]);

  const confirm = async () => {
    setBusy(true);
    setErr("");
    try { const r = await api.post("/admin/decision", { token, action, note: note.trim() || null }); setBiz(r.data); }
    catch (e) { setErr(formatErr(e)); } finally { setBusy(false); }
  };

  const status = biz?.business_status;
  const reject = action === "reject";
  return (
    <div className="mx-auto max-w-lg px-5 pb-28 pt-14" data-testid="admin-decide-page">
      <Eyebrow>Partner application</Eyebrow>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{reject ? "Reject this business?" : "Approve this business?"}</h1>
      {biz && <Applicant biz={biz} />}
      {status && status !== "pending" && (
        <p className={`mt-6 rounded-2xl p-5 ${status === "approved" ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#FDF0EC] text-[#9A4024]"}`} data-testid="decide-result">
          {DONE[status] || `Status: ${status}`}
        </p>
      )}
      {status === "pending" && (
        <div className="mt-6 space-y-4">
          <div className="flex gap-2" data-testid="decide-toggle">
            {["approve", "reject"].map((a) => (
              <button key={a} onClick={() => setAction(a)} data-testid={`decide-pick-${a}`}
                className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition-colors ${action === a ? "bg-[#17434C] text-[#EAF6F3]" : "bg-white text-[#17434C]"}`}>{a}</button>
            ))}
          </div>
          {reject && <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Optional reason — included in their email"
            className="min-h-24 rounded-xl border-[#C2DEDA] bg-white" data-testid="decide-note-input" />}
          <button onClick={confirm} disabled={busy} data-testid="decide-confirm-btn"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full py-4 font-semibold transition-transform active:scale-[0.98] disabled:opacity-60 ${reject ? "bg-[#9A4024] text-white" : "bg-[#4E7A58] text-white"}`}>
            {reject ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}{busy ? "Saving…" : reject ? "Confirm reject" : "Confirm approve"}
          </button>
        </div>
      )}
      {err && <p className="mt-6 rounded-xl bg-[#FDF0EC] p-4 text-sm text-[#9A4024]" data-testid="decide-error">{err}</p>}
      <Link to={ap("")} className="mt-8 inline-block text-sm font-semibold text-[#9A4024]" data-testid="decide-control-room-link">Go to the control room →</Link>
    </div>
  );
}
