import { useState } from "react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { btn, fmtDate } from "@/admin/DataTable";

/** Shown inside the admin deal dialog when the business has asked for the deal to be taken down. */
export function RemovalRequestBox({ deal, onDone }) {
  const [busy, setBusy] = useState(false);
  if (deal?.status === "removed") {
    return (
      <div className="rounded-xl border border-[#D7E7E4] bg-[#ECECEC] p-4 text-sm" data-testid="removal-history-box">
        <p className="font-semibold">Taken off the site {fmtDate(deal.removed_at)}</p>
        {deal.removal_reason && <p className="mt-1 text-[#3D5E65]">Business's reason: “{deal.removal_reason}”</p>}
      </div>
    );
  }
  if (!deal?.removal_requested_at || deal.status !== "approved") return null;

  const decide = async (approve) => {
    const note = window.prompt(approve ? "Optional: a note for the business (included in their email)." : "Optional: why it's staying live (included in their email).", "");
    if (note === null) return;
    setBusy(true);
    try {
      await api.post(`/admin/deals/${deal.id}/removal`, { approve, note: note.trim() || null });
      toast.success(approve ? "Deal taken off the site — business emailed" : "Request declined — deal stays live");
      onDone();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border-2 border-[#FF70A6] bg-[#FFE3EC] p-4" data-testid="removal-request-box">
      <p className="font-semibold text-[#750B35]">The business asked to remove this deal · {fmtDate(deal.removal_requested_at)}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-[#17434C]" data-testid="removal-request-reason">“{deal.removal_reason}”</p>
      <p className="mt-1 text-xs text-[#3D5E65]">Approving takes it off the site. Past vouchers and savings stay in your records.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => decide(true)} className={btn.dark} data-testid="removal-approve-btn">Approve removal</button>
        <button disabled={busy} onClick={() => decide(false)} className={btn.ghost} data-testid="removal-decline-btn">Decline, keep it live</button>
      </div>
    </div>
  );
}
