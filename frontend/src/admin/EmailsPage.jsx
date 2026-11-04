import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { PageHead } from "@/admin/AdminShell";
import { TemplateEditor } from "@/admin/TemplateEditor";
import { ReplyInbox } from "@/admin/ReplyInbox";

const GROUPS = [
  ["Member invites", (t) => t.base === "invite", "invite"],
  ["Invite follow-ups", (t) => t.base === "invite_followup", "invite_followup"],
  ["Partner pitches", (t) => t.base === "pitch", "pitch"],
  ["Emails to members", (t) => t.kind === "auto" && t.audience === "member"],
  ["Emails to partners", (t) => t.kind === "auto" && t.audience === "business"],
  ["Emails to you", (t) => t.kind === "auto" && t.audience === "owner"],
];

export default function EmailsPage() {
  const [list, setList] = useState(null);
  const [key, setKey] = useState("invite");
  useEffect(() => { api.get("/admin/email-templates").then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([])); }, []);

  const saved = (t) => setList((l) => l.map((x) => (x.key === t.key ? t : x)));
  const removed = (k) => { setList((l) => l.filter((x) => x.key !== k)); setKey(k.split("-")[0]); };
  const addVersion = async (base) => {
    const label = { invite: ["Name this member invite version", "Invite — school mums"], invite_followup: ["Name this follow-up version", "Follow-up — friendly"] }[base]
      || ["Name this partner pitch version", "Pitch — cafes"];
    const name = window.prompt(label[0], label[1]);
    if (!name) return;
    try { const { data } = await api.post("/admin/email-templates", { base, name }); setList((l) => [...l, data]); setKey(data.key); toast.success("New version added"); }
    catch (e) { toast.error(formatErr(e)); }
  };
  const current = list?.find((t) => t.key === key);

  return (
    <div data-testid="admin-emails-page">
      <PageHead title="Emails" sub="Edit the wording and layout of every email Go Perks sends. Make extra versions of the invite and pitch to pick from when you send." />
      <ReplyInbox />
      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="space-y-4 rounded-2xl border border-[#D7E7E4] bg-white p-3" data-testid="template-list">
          {list === null ? <p className="p-2 font-mono text-xs text-[#3D5E65]">Loading…</p> : GROUPS.map(([label, test, base]) => (
            <div key={label}>
              <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#3D5E65]">{label}</p>
              {list.filter(test).map((t) => (
                <button key={t.key} onClick={() => setKey(t.key)} data-testid={`template-item-${t.key}`}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${t.key === key ? "bg-[#17434C] text-white" : "hover:bg-[#EAF6F3]"}`}>
                  <span className="truncate">{t.name}</span>{t.edited && !t.custom && <span className="shrink-0 text-[10px] font-bold uppercase opacity-70">edited</span>}
                </button>
              ))}
              {base && <button onClick={() => addVersion(base)} className="mt-1 inline-flex items-center gap-1 px-2 text-xs font-semibold text-[#9A4024] hover:underline" data-testid={`template-add-${base}`}><Plus className="h-3.5 w-3.5" /> New version</button>}
            </div>
          ))}
        </nav>
        {current ? <TemplateEditor key={current.key} t={current} onSaved={saved} onRemoved={removed} /> : list && <p className="text-[#3D5E65]">Pick a template.</p>}
      </div>
    </div>
  );
}
