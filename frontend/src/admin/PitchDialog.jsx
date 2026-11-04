import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btn } from "@/admin/DataTable";
import { TemplateSelect } from "@/admin/TemplateSelect";
import { OwnEmailDrafts } from "@/admin/OwnEmailDrafts";

/** Write the partner pitch for the selected prospects; the owner sends each one from their own email. */
export function PitchDialog({ prospects, onClose, onSent }) {
  const [note, setNote] = useState("");
  const [tpl, setTpl] = useState("pitch");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const withEmail = prospects.filter((p) => p.email);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/admin/prospects/pitch-preview", { params: { note, template: tpl } }).then((r) => setPreview(r.data)).catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [note, tpl]);

  const prepare = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/prospects/pitch", { ids: prospects.map((p) => p.id), note, template: tpl });
      setResult(data);
      if (!data?.drafts?.length) toast.info("No pitches to send");
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  const markSent = (d) => api.post(`/admin/prospects/${d.id}/pitched`, { template: result.template }).then(onSent).catch((e) => toast.error(formatErr(e)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] max-w-2xl overflow-y-auto bg-[#F3F8F7]" data-lenis-prevent data-testid="pitch-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">Send partner pitch</DialogTitle></DialogHeader>
        <p className="text-sm text-[#3D5E65]" data-testid="pitch-recipients">
          To {withEmail.length} {withEmail.length === 1 ? "business" : "businesses"}: {prospects.slice(0, 4).map((p) => p.business_name).join(", ")}{prospects.length > 4 ? ` and ${prospects.length - 4} more` : ""}.
          Pitches are sent from your own email, one by one, so replies come straight to you. Anyone who asked not to be contacted or was already pitched is skipped.
        </p>
        {!result && <>
          <TemplateSelect base="pitch" value={tpl} onChange={setTpl} testid="pitch-template-select" />
          <label htmlFor="pitch-note" className="text-sm font-semibold">Your note <span className="font-normal text-[#3D5E65]">(optional)</span></label>
          <textarea id="pitch-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} data-testid="pitch-note-input"
            placeholder="I'm a regular at your place and members would love it!" className="w-full rounded-lg border border-[#D7E7E4] bg-white p-3 text-sm outline-none focus:border-[#17434C]" />
          <p className="-mt-2 text-right text-xs text-[#3D5E65]">{note.length}/300</p>
          {preview && (
            <div className="overflow-hidden rounded-xl border border-[#D7E7E4] bg-white" data-testid="pitch-preview">
              <p className="border-b border-[#E3F0ED] px-3 py-2 text-sm"><span className="text-[#3D5E65]">Subject:</span> <b>{preview.subject}</b></p>
              <p className="max-h-[360px] overflow-y-auto whitespace-pre-wrap p-3 text-sm" data-testid="pitch-preview-text">{preview.text}</p>
            </div>
          )}
        </>}
        {result?.skipped?.length > 0 && (
          <div className="rounded-lg bg-[#FEF4DC] p-3 text-sm text-[#7A5310]" data-testid="pitch-skipped">
            <p className="font-semibold">Skipped {result.skipped.length}:</p>
            <ul className="mt-1">{result.skipped.map((s, i) => <li key={i}>{s.business_name} {s.reason}</li>)}</ul>
          </div>
        )}
        {result && <OwnEmailDrafts drafts={result.drafts} onSent={markSent} />}
        {result ? <button onClick={onClose} className={`${btn.dark} h-10 w-full justify-center`} data-testid="pitch-done-btn">Done</button> : (
          <button onClick={prepare} disabled={busy || !withEmail.length} className={`${btn.primary} h-10 w-full justify-center`} data-testid="pitch-send-btn">
            <Mail className="h-4 w-4" /> {busy ? "Getting them ready…" : `Write ${withEmail.length} ${withEmail.length === 1 ? "pitch" : "pitches"}`}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
