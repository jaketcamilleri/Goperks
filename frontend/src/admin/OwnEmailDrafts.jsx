import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Mail } from "lucide-react";

const enc = encodeURIComponent;
const gmailUrl = (d) => `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(d.to)}&su=${enc(d.subject)}&body=${enc(d.body)}`;
const mailtoUrl = (d) => `mailto:${d.to}?subject=${enc(d.subject)}&body=${enc(d.body)}`;
const link = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D7E7E4] bg-white px-2.5 text-xs font-semibold text-[#17434C] transition-colors hover:bg-[#EAF6F3]";

function DraftRow({ d, done, onOpen }) {
  const copy = () => navigator.clipboard?.writeText(`Subject: ${d.subject}\n\n${d.body}`).then(() => toast.success("Message copied"), () => toast.error("Couldn't copy"));
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5" data-testid={`draft-${d.id}`}>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold">{done && <Check className="h-4 w-4 shrink-0 text-[#2F5A3A]" />}{d.name}</p>
        <p className="truncate text-xs text-[#3D5E65]">{d.to}{done ? " · marked as sent" : ""}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <a href={gmailUrl(d)} target="_blank" rel="noreferrer" onClick={() => onOpen(d)} className={link} data-testid={`draft-gmail-${d.id}`}><Mail className="h-3.5 w-3.5" /> Gmail</a>
        <a href={mailtoUrl(d)} onClick={() => onOpen(d)} className={link} data-testid={`draft-mailto-${d.id}`}><Mail className="h-3.5 w-3.5" /> Email app</a>
        <button type="button" onClick={copy} className={link} data-testid={`draft-copy-${d.id}`}><Copy className="h-3.5 w-3.5" /> Copy</button>
      </div>
    </li>
  );
}

/** Ready-written messages the owner sends one by one from their own email account. Opening one marks it as sent. */
export function OwnEmailDrafts({ drafts, onSent }) {
  const [done, setDone] = useState(() => new Set());
  if (!drafts?.length) return null;
  const open = (d) => {
    if (done.has(d.id)) return;
    setDone((s) => new Set(s).add(d.id));
    onSent(d);
  };
  return (
    <div className="rounded-xl border border-[#D7E7E4] bg-[#F7FBFA] p-3" data-testid="own-email-drafts">
      <p className="text-sm font-semibold">{done.size} of {drafts.length} opened</p>
      <p className="text-xs text-[#3D5E65]">Each one opens ready-written in your own email, from your address. Check it and press send there.</p>
      <ul className="mt-1 max-h-80 divide-y divide-[#E3F0ED] overflow-y-auto">
        {drafts.map((d) => <DraftRow key={d.id} d={d} done={done.has(d.id)} onOpen={open} />)}
      </ul>
    </div>
  );
}
