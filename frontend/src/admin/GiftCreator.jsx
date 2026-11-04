import { useState } from "react";
import { toast } from "sonner";
import { Gift, Copy, Mail, Ticket } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";

const LENGTHS = [[1, "1 month"], [3, "3 months"], [6, "6 months"], [12, "1 year"]];
const field = "mt-1 h-10 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm outline-none focus:border-[#17434C]";
const copyAll = (codes) => navigator.clipboard?.writeText(codes.join("\n")).then(() => toast.success("Codes copied"), () => toast.error("Couldn't copy"));

function Choice({ value, set, options, id }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map(([v, label, Icon]) => (
        <button key={v} type="button" onClick={() => set(v)} data-testid={`${id}-${v}`}
          className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${value === v ? "border-[#17434C] bg-[#17434C] text-white" : "border-[#D7E7E4] bg-white hover:bg-[#EAF6F3]"}`}>
          {Icon && <Icon className="h-4 w-4" />}{label}
        </button>
      ))}
    </div>
  );
}

function Created({ result }) {
  if (!result?.codes?.length) return null;
  return (
    <div className="mt-5 rounded-xl bg-[#EBF3EC] p-4" data-testid="gift-created-result">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#2F5A3A]">
          {result.codes.length} code{result.codes.length === 1 ? "" : "s"} created{result.emailed ? " and emailed" : ""}.
        </p>
        <button onClick={() => copyAll(result.codes)} className={btn.ghost} data-testid="gift-copy-all-btn"><Copy className="h-4 w-4" /> Copy all</button>
      </div>
      <p className="mt-2 max-h-40 overflow-auto break-all font-mono text-sm" data-testid="gift-created-codes">{result.codes.join(", ")}</p>
    </div>
  );
}

export function GiftCreator({ onCreated }) {
  const [months, setMonths] = useState(12);
  const [mode, setMode] = useState("email");
  const [f, setF] = useState({ recipient_name: "", recipient_email: "", message: "", note: "", quantity: 1 });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const emailing = mode === "email";
  const ready = emailing ? f.recipient_name.trim() && /\S+@\S+\.\S+/.test(f.recipient_email) : Number(f.quantity) >= 1;

  const create = async () => {
    setBusy(true);
    try {
      const body = emailing
        ? { months, quantity: 1, recipient_name: f.recipient_name, recipient_email: f.recipient_email, message: f.message || null, note: f.note || null }
        : { months, quantity: Math.min(200, Math.max(1, Number(f.quantity) || 1)), note: f.note || null };
      const { data } = await api.post("/admin/gifts", body);
      setResult(data);
      if (emailing && !data?.emailed) toast.error("Code created, but the email didn't send. Copy the code and send it yourself.");
      else toast.success(emailing ? `Gift emailed to ${f.recipient_email}` : "Gift codes created");
      setF({ recipient_name: "", recipient_email: "", message: "", note: "", quantity: 1 });
      onCreated?.();
    } catch (e) { toast.error(formatErr(e)); } finally { setBusy(false); }
  };

  return (
    <section className="mb-8 rounded-2xl border border-[#D3ECE7] bg-white p-5 sm:p-6" data-testid="gift-creator">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Gift className="h-5 w-5 text-[#B9512E]" /> Create gift codes</h2>
      <p className="mt-1 text-sm text-[#3D5E65]">Each code works once and gives free membership. If the person is already a member, it's added to the end of their membership.</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div><span className="text-sm font-semibold">Free membership</span><Choice id="gift-months" value={months} set={setMonths} options={LENGTHS} /></div>
        <div><span className="text-sm font-semibold">How to give it</span>
          <Choice id="gift-mode" value={mode} set={setMode} options={[["email", "Email it to someone", Mail], ["codes", "Make codes to hand out", Ticket]]} /></div>
      </div>
      {emailing ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Their name<input value={f.recipient_name} onChange={set("recipient_name")} maxLength={100} className={field} data-testid="gift-recipient-name-input" /></label>
          <label className="text-sm font-semibold">Their email<input type="email" value={f.recipient_email} onChange={set("recipient_email")} className={field} data-testid="gift-recipient-email-input" /></label>
          <label className="text-sm font-semibold sm:col-span-2">Message in the email <span className="font-normal text-[#3D5E65]">(optional)</span>
            <textarea value={f.message} onChange={set("message")} maxLength={500} rows={2} className={`${field} h-auto py-2`} data-testid="gift-message-input" /></label>
        </div>
      ) : (
        <label className="mt-5 block max-w-[200px] text-sm font-semibold">How many codes<input type="number" min={1} max={200} value={f.quantity} onChange={set("quantity")} className={field} data-testid="gift-quantity-input" /></label>
      )}
      <label className="mt-4 block text-sm font-semibold">Note for yourself <span className="font-normal text-[#3D5E65]">(optional, e.g. "Radio giveaway")</span>
        <input value={f.note} onChange={set("note")} maxLength={200} className={field} data-testid="gift-note-input" /></label>
      <button onClick={create} disabled={busy || !ready} className={`${btn.primary} mt-5`} data-testid="gift-create-btn">
        {busy ? "Creating…" : emailing ? "Create and email gift" : `Create ${Math.max(1, Number(f.quantity) || 1)} code${Number(f.quantity) === 1 ? "" : "s"}`}
      </button>
      <Created result={result} />
    </section>
  );
}
