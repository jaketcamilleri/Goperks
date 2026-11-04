import { useState } from "react";
import { toast } from "sonner";
import { api, formatErr, CATEGORIES } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btn } from "@/admin/DataTable";
import { SuburbPicker } from "@/components/SuburbPicker";

export const STATUSES = [
  ["new", "New"], ["contacted", "Contacted"], ["interested", "Interested"], ["joined", "Joined"], ["not_interested", "Not interested"],
];
const field = "mt-1 h-10 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm outline-none focus:border-[#17434C]";
const BLANK = { business_name: "", category: "cafes", address: "", suburb: "", postcode: "", website: "", email: "", phone: "", status: "new", notes: "" };

/** Add (prospect = null) or edit a prospect. */
export function ProspectDialog({ prospect, onClose, onSaved }) {
  const [f, setF] = useState(prospect ? { ...BLANK, ...prospect } : BLANK);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    if (f.suburb && !f.postcode) { toast.error("Pick the suburb from the list so we have the postcode"); return; }
    setBusy(true);
    const body = Object.fromEntries(Object.keys(BLANK).map((k) => [k, f[k] ?? ""]));
    try {
      if (prospect) await api.patch(`/admin/prospects/${prospect.id}`, body);
      else await api.post("/admin/prospects", body);
      toast.success(prospect ? "Saved" : "Prospect added");
      onSaved(); onClose();
    } catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${prospect.business_name} from your prospects?`)) return;
    try { await api.delete(`/admin/prospects/${prospect.id}`); toast.success("Removed"); onSaved(); onClose(); }
    catch (err) { toast.error(formatErr(err)); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] max-w-lg overflow-y-auto bg-[#F3F8F7]" data-lenis-prevent data-testid="prospect-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">{prospect ? prospect.business_name : "Add a prospect"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <label className="block text-sm font-medium">Business name<input required value={f.business_name} onChange={set("business_name")} className={field} data-testid="prospect-name-input" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Type<select value={f.category} onChange={set("category")} className={field} data-testid="prospect-category-select">
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
            <div className="text-sm font-medium">Suburb and postcode
              <SuburbPicker suburb={f.suburb} postcode={f.postcode} testid="prospect-suburb" className={field} placeholder="Suburb or postcode"
                onChange={({ suburb, postcode }) => setF((cur) => ({ ...cur, suburb, postcode }))} />
            </div>
            <label className="block text-sm font-medium sm:col-span-2">Street address <span className="font-normal text-[#3D5E65]">(for the map)</span>
              <input value={f.address} onChange={set("address")} placeholder="12 Anderson Street" className={field} data-testid="prospect-address-input" /></label>
            <label className="block text-sm font-medium">Email<input type="email" value={f.email} onChange={set("email")} className={field} data-testid="prospect-email-input" /></label>
            <label className="block text-sm font-medium">Phone<input value={f.phone} onChange={set("phone")} className={field} data-testid="prospect-phone-input" /></label>
          </div>
          <label className="block text-sm font-medium">Website<input value={f.website} onChange={set("website")} className={field} data-testid="prospect-website-input" /></label>
          <label className="block text-sm font-medium">Status<select value={f.status} onChange={set("status")} className={field} data-testid="prospect-status-select">
            {STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="block text-sm font-medium">Notes<textarea value={f.notes} onChange={set("notes")} rows={3} maxLength={1000} placeholder="Who you spoke to, what they said, when to follow up"
            className="mt-1 w-full rounded-lg border border-[#D7E7E4] bg-white p-3 text-sm outline-none focus:border-[#17434C]" data-testid="prospect-notes-input" /></label>
          {prospect?.source_url && (
            <p className="text-xs text-[#3D5E65]">Email found on: {prospect.source_url.startsWith("http")
              ? <a href={prospect.source_url} target="_blank" rel="noreferrer" className="break-all font-semibold text-[#9A4024] hover:underline">{prospect.source_url}</a> : prospect.source_url}</p>
          )}
          {prospect?.pitch_status && (
            <p className="text-xs text-[#3D5E65]" data-testid="prospect-pitch-info">Partner pitch: <b>{prospect.pitch_status === "sent" ? `sent ${new Date(prospect.pitched_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}` : prospect.pitch_status === "queued" ? "sending" : `not sent (${prospect.pitch_error || "error"})`}</b></p>
          )}
          <div className="flex gap-2 pt-1">
            {prospect && <button type="button" onClick={remove} className={btn.danger} data-testid="prospect-delete-btn">Remove</button>}
            <button disabled={busy} className={`${btn.primary} flex-1 justify-center`} data-testid="prospect-save-btn">{busy ? "Saving…" : prospect ? "Save" : "Add prospect"}</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
