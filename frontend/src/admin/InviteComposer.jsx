import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";

export const parsePeople = (text) => text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const m = l.match(/[^\s,;<>]+@[^\s,;<>]+/);
  return { email: m ? m[0] : l, name: (m ? l.replace(m[0], "") : "").replace(/[<>,;\t]/g, " ").replace(/\s+/g, " ").trim() };
});

export function InviteComposer({ onSent }) {
  const [list, setList] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const people = parsePeople(list);

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/admin/invites", { people, note });
      setResult(data);
      if (data?.queued) { toast.success(`Sending ${data.queued} invite${data.queued === 1 ? "" : "s"}`); setList(""); }
      else toast.info("No new invites to send");
      onSent?.();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#D7E7E4] bg-white p-4 sm:p-5" data-testid="invite-composer">
      <label htmlFor="invite-list" className="text-sm font-semibold">Who to invite</label>
      <p className="mt-0.5 text-xs text-[#3D5E65]">One person per line, like <span className="font-mono">Tony, tony@example.com</span>. A name is optional.</p>
      <textarea id="invite-list" value={list} onChange={(e) => setList(e.target.value)} rows={5} data-testid="invite-list-input"
        placeholder={"Tony, tony@example.com\nsam@example.com"}
        className="mt-2 w-full rounded-lg border border-[#D7E7E4] bg-[#F7FBFA] p-3 font-mono text-sm outline-none focus:border-[#17434C]" />
      <label htmlFor="invite-note" className="mt-4 block text-sm font-semibold">Your note <span className="font-normal text-[#3D5E65]">(optional)</span></label>
      <textarea id="invite-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} rows={2} data-testid="invite-note-input"
        placeholder="Great to see you at the cafe last week!"
        className="mt-2 w-full rounded-lg border border-[#D7E7E4] bg-[#F7FBFA] p-3 text-sm outline-none focus:border-[#17434C]" />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#3D5E65]" data-testid="invite-count">{people.length} {people.length === 1 ? "person" : "people"} · {note.length}/300</p>
        <button onClick={send} disabled={busy || !people.length || people.length > 200} className={btn.primary} data-testid="invite-send-btn">
          <Send className="h-4 w-4" /> {busy ? "Sending…" : `Send ${people.length || ""} invite${people.length === 1 ? "" : "s"}`}
        </button>
      </div>
      {result?.skipped?.length > 0 && (
        <div className="mt-4 rounded-lg bg-[#FEF4DC] p-3 text-sm text-[#7A5310]" data-testid="invite-skipped">
          <p className="font-semibold">Skipped {result.skipped.length}:</p>
          <ul className="mt-1 space-y-0.5">{result.skipped.map((s, i) => <li key={i}><span className="font-mono">{s.email}</span> {s.reason}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
