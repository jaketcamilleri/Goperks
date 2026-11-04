import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btn } from "@/admin/DataTable";
import { TemplateSelect } from "@/admin/TemplateSelect";

/** Preview and send the ready-made partner pitch to the selected prospects. */
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

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/prospects/pitch", { ids: prospects.map((p) => p.id), note, template: tpl });
      setResult(data);
      if (data?.queued) toast.success(`Sending ${data.queued} pitch${data.queued === 1 ? "" : "es"}`);
      else toast.info("No pitches to send");
      onSent();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-h-[92vh] max-w-2xl overflow-y-auto bg-[#F3F8F7]" data-lenis-prevent data-testid="pitch-dialog">
        <DialogHeader><DialogTitle className="font-display text-2xl">Send partner pitch</DialogTitle></DialogHeader>
        <p className="text-sm text-[#3D5E65]" data-testid="pitch-recipients">
          To {withEmail.length} {withEmail.length === 1 ? "business" : "businesses"}: {prospects.slice(0, 4).map((p) => p.business_name).join(", ")}{prospects.length > 4 ? ` and ${prospects.length - 4} more` : ""}.
          Replies come to your inbox. Each business's name goes where it says [Business name], and anyone who unsubscribed or was already pitched is skipped.
        </p>
        <TemplateSelect base="pitch" value={tpl} onChange={setTpl} testid="pitch-template-select" />
        <label htmlFor="pitch-note" className="text-sm font-semibold">Your note <span className="font-normal text-[#3D5E65]">(optional)</span></label>
        <textarea id="pitch-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} data-testid="pitch-note-input"
          placeholder="I'm a regular at your place and members would love it!" className="w-full rounded-lg border border-[#D7E7E4] bg-white p-3 text-sm outline-none focus:border-[#17434C]" />
        <p className="-mt-2 text-right text-xs text-[#3D5E65]">{note.length}/300</p>
        {preview && (
          <div className="overflow-hidden rounded-xl border border-[#D7E7E4] bg-white" data-testid="pitch-preview">
            <p className="border-b border-[#E3F0ED] px-3 py-2 text-sm"><span className="text-[#3D5E65]">Subject:</span> <b>{preview.subject}</b></p>
            <iframe title="Pitch preview" srcDoc={preview.html} sandbox="" className="h-[420px] w-full" />
          </div>
        )}
        {result?.skipped?.length > 0 && (
          <div className="rounded-lg bg-[#FEF4DC] p-3 text-sm text-[#7A5310]" data-testid="pitch-skipped">
            <p className="font-semibold">Skipped {result.skipped.length}:</p>
            <ul className="mt-1">{result.skipped.map((s, i) => <li key={i}>{s.business_name} {s.reason}</li>)}</ul>
          </div>
        )}
        {result ? <button onClick={onClose} className={`${btn.dark} h-10 w-full justify-center`} data-testid="pitch-done-btn">Done</button> : (
          <button onClick={send} disabled={busy || !withEmail.length} className={`${btn.primary} h-10 w-full justify-center`} data-testid="pitch-send-btn">
            <Send className="h-4 w-4" /> {busy ? "Sending…" : `Send to ${withEmail.length} ${withEmail.length === 1 ? "business" : "businesses"}`}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
