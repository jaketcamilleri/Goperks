import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Reply } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";

/** The inbox that replies to Go Perks emails go to. */
export function ReplyInbox() {
  const [saved, setSaved] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/admin/email-settings").then((r) => { const v = r.data?.reply_to ?? ""; setSaved(v); setValue(v); }).catch(() => {});
  }, []);
  const valid = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(value.trim());

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/email-settings", { reply_to: value.trim() });
      setSaved(data?.reply_to ?? value.trim()); setValue(data?.reply_to ?? value.trim());
      toast.success("Reply inbox saved");
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <section className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[#D7E7E4] bg-white p-4" data-testid="reply-inbox">
      <label className="min-w-0 flex-1 text-sm font-semibold" htmlFor="reply-inbox-input">
        <span className="flex items-center gap-1.5"><Reply className="h-4 w-4 text-[#B9512E]" /> Replies go to</span>
        <span className="mt-0.5 block text-xs font-normal text-[#3D5E65]">When someone hits reply on any Go Perks email, it goes to this inbox.</span>
        <input id="reply-inbox-input" type="email" value={value} onChange={(e) => setValue(e.target.value)} placeholder="hello@goperks.au"
          className="mt-2 h-10 w-full max-w-md rounded-lg border border-[#D7E7E4] px-3 text-sm font-normal outline-none focus:border-[#17434C]" data-testid="reply-inbox-input" />
      </label>
      <button onClick={save} disabled={busy || !valid || value.trim().toLowerCase() === saved} className={btn.primary} data-testid="reply-inbox-save-btn">
        {busy ? "Saving…" : "Save"}
      </button>
    </section>
  );
}
