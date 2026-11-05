import { useState } from "react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const REASONS = ["Offer ended", "Closing down", "Changing the offer", "Too busy to honour it", "Moving location", "Other"];

/** Business asks the Go Perks team to take a live deal down: pick a quick reason, add details if they like. */
export function RemovalRequestDialog({ deal, onClose, onSent }) {
  const [pick, setPick] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const extra = details.trim();
  const reason = [pick, extra].filter(Boolean).join(": ");
  const ok = pick ? (pick !== "Other" || extra.length >= 3) : extra.length >= 3;

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/business/deals/${deal.id}/removal-request`, { reason });
      toast.success("Removal requested — we'll be in touch");
      onSent();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white" data-testid="removal-request-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">Remove “{deal.title}”?</DialogTitle></DialogHeader>
        <p className="-mt-2 text-sm text-[#3D5E65]">The Go Perks team reviews every request. Your deal stays live until then.</p>
        <p className="text-sm font-semibold">Why should it come down?</p>
        <div className="flex flex-wrap gap-2" data-testid="removal-reason-options">
          {REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setPick(pick === r ? "" : r)} aria-pressed={pick === r}
              data-testid={`removal-reason-${r.toLowerCase().replace(/\s+/g, "-")}`}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${pick === r ? "border-[#17434C] bg-[#FFD166] text-[#17434C]" : "border-[#C2DEDA] bg-white text-[#17434C] hover:border-[#17434C]"}`}>
              {r}
            </button>
          ))}
        </div>
        <label className="block text-sm font-semibold">Anything else we should know?{pick === "Other" && <span className="text-[#9A4024]"> (required)</span>}
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={400} rows={3}
            placeholder={pick === "Other" ? "Tell us why" : "Optional, e.g. the date it should come down"}
            className="mt-1 w-full rounded-xl border border-[#C2DEDA] px-3 py-2 text-sm font-normal outline-none focus:border-[#17434C]" data-testid="removal-reason-details" />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={onClose} className="rounded-full border-2 border-[#17434C] px-5 py-2.5 text-sm font-semibold" data-testid="removal-request-cancel">Cancel</button>
          <button onClick={send} disabled={!ok || busy} className="rounded-full border-2 border-[#17434C] bg-[#B9512E] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50" data-testid="removal-request-send">
            {busy ? "Sending…" : "Send request"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
