import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, RotateCcw, Trash2 } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { btn } from "@/admin/DataTable";

export const LAYOUTS = [
  ["classic", "Classic card", "bg-[#EAF6F3] border-[#C2DEDA]"], ["banner", "Photo banner", "bg-[linear-gradient(#B9512E_0_38%,#EAF6F3_38%)] border-[#C2DEDA]"],
  ["letter", "Plain letter", "bg-white border-[#D7E7E4]"], ["dark", "Bold dark", "bg-[#17434C] border-[#17434C]"],
];
const field = "mt-1 w-full rounded-lg border border-[#D7E7E4] bg-white px-3 text-sm outline-none focus:border-[#17434C]";
const pick = (t) => ({ name: t.name, subject: t.subject, heading: t.heading, intro: t.intro, bullets: (t.bullets || []).join("\n"),
  outro: t.outro, button: t.button, layout: t.layout, banner_url: t.banner_url || "" });
const payload = (f) => ({ ...f, bullets: f.bullets.split("\n").map((b) => b.trim()).filter(Boolean) });

function LayoutPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="template-layouts">
      {LAYOUTS.map(([k, l, look]) => (
        <button key={k} type="button" onClick={() => onChange(k)} data-testid={`template-layout-${k}`}
          className={`rounded-xl border-2 p-2 text-left text-xs font-semibold transition-colors ${value === k ? "border-[#B9512E]" : "border-transparent hover:border-[#C2DEDA]"}`}>
          <span className={`mb-1.5 block h-12 rounded-md border ${look}`} />{l}
        </button>
      ))}
    </div>
  );
}

function BannerField({ value, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Photo must be under 5 MB"); return; }
    const fd = new FormData();
    fd.append("file", file);
    setBusy(true);
    try { const { data } = await api.post("/admin/email-templates/banner", fd); onChange(data?.url || ""); toast.success("Photo uploaded. Save to keep it."); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };
  return (
    <div className="text-sm font-medium" data-testid="template-banner">
      Banner photo
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <img src={value || "/email/banner.jpg"} alt="Banner" className="h-16 w-36 rounded-lg border border-[#D7E7E4] object-cover" data-testid="template-banner-thumb" />
        <button type="button" onClick={() => input.current?.click()} disabled={busy} className={btn.ghost} data-testid="template-banner-upload-btn">
          <ImageUp className="h-4 w-4" /> {busy ? "Uploading…" : "Upload photo"}</button>
        {value && <button type="button" onClick={() => onChange("")} className="text-xs font-semibold text-[#9A4024] hover:underline" data-testid="template-banner-clear-btn">Use the cafe photo</button>}
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden" data-testid="template-banner-file" />
      </div>
      <p className="mt-1 text-xs font-normal text-[#3D5E65]">PNG, JPG or WebP under 5 MB. A wide photo (about 1200 × 500) looks best.</p>
    </div>
  );
}

function Preview({ tkey, form }) {
  const [p, setP] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      api.post("/admin/email-templates/preview", { key: tkey, ...payload(form), note: "" }).then((r) => setP(r.data)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [tkey, form]);
  return (
    <div className="overflow-hidden rounded-xl border border-[#D7E7E4] bg-white lg:sticky lg:top-4" data-testid="template-preview">
      <p className="border-b border-[#E3F0ED] px-3 py-2 text-sm"><span className="text-[#3D5E65]">Subject:</span> <b data-testid="template-preview-subject">{p?.subject || "…"}</b></p>
      {p && <iframe title="Email preview" srcDoc={p.html} sandbox="" className="h-[620px] w-full" />}
      <p className="border-t border-[#E3F0ED] px-3 py-2 text-xs text-[#3D5E65]">Preview uses sample names and numbers. Live details like member cards and stats are filled in when it sends.</p>
    </div>
  );
}

/** Edit one template: wording, bullet points, button and layout, with a live preview. */
export function TemplateEditor({ t, onSaved, onRemoved }) {
  const [f, setF] = useState(() => pick(t));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(pick(t)); }, [t]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try { const { data } = await api.put(`/admin/email-templates/${t.key}`, payload(f)); toast.success("Template saved"); onSaved(data); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(t.custom ? `Delete "${t.name}"?` : "Go back to the original wording and layout?")) return;
    try { const { data } = await api.delete(`/admin/email-templates/${t.key}`); toast.success(t.custom ? "Deleted" : "Back to the original"); t.custom ? onRemoved(t.key) : onSaved(data); }
    catch (err) { toast.error(formatErr(err)); }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="template-editor">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#D7E7E4] bg-white p-4 sm:p-5">
        {t.custom && <label className="block text-sm font-medium">Version name<input required value={f.name} onChange={set("name")} className={`${field} h-10`} data-testid="template-name-input" /></label>}
        <div><p className="text-sm font-medium">Layout</p><LayoutPicker value={f.layout} onChange={(layout) => setF({ ...f, layout })} /></div>
        {f.layout === "banner" && <BannerField value={f.banner_url} onChange={(banner_url) => setF({ ...f, banner_url })} />}
        <label className="block text-sm font-medium">Subject line<input required value={f.subject} onChange={set("subject")} maxLength={200} className={`${field} h-10`} data-testid="template-subject-input" /></label>
        <label className="block text-sm font-medium">Heading<input required value={f.heading} onChange={set("heading")} maxLength={200} className={`${field} h-10`} data-testid="template-heading-input" /></label>
        <label className="block text-sm font-medium">Opening text<textarea value={f.intro} onChange={set("intro")} rows={6} maxLength={3000} className={`${field} py-2`} data-testid="template-intro-input" /></label>
        <label className="block text-sm font-medium">Bullet points <span className="font-normal text-[#3D5E65]">(one per line, optional)</span>
          <textarea value={f.bullets} onChange={set("bullets")} rows={4} className={`${field} py-2`} data-testid="template-bullets-input" /></label>
        <label className="block text-sm font-medium">Closing text<textarea value={f.outro} onChange={set("outro")} rows={3} maxLength={3000} className={`${field} py-2`} data-testid="template-outro-input" /></label>
        <label className="block text-sm font-medium">Button text<input required value={f.button} onChange={set("button")} maxLength={60} className={`${field} h-10`} data-testid="template-button-input" /></label>
        <div className="rounded-lg bg-[#F7FBFA] p-3 text-xs text-[#3D5E65]" data-testid="template-help">
          <p>Fill-ins: {["brand", ...t.vars].map((v) => <code key={v} className="mr-1 rounded bg-white px-1.5 py-0.5 font-mono text-[#17434C]">{`{${v}}`}</code>)}</p>
          <p className="mt-1">Wrap words in **double stars** for bold. Leave a blank line to start a new paragraph.</p>
        </div>
        <div className="flex gap-2">
          {(t.custom || t.edited) && <button type="button" onClick={remove} className={btn.danger} data-testid="template-reset-btn">
            {t.custom ? <><Trash2 className="h-4 w-4" /> Delete</> : <><RotateCcw className="h-4 w-4" /> Reset to original</>}</button>}
          <button disabled={busy} className={`${btn.primary} flex-1 justify-center`} data-testid="template-save-btn">{busy ? "Saving…" : "Save template"}</button>
        </div>
      </form>
      <Preview tkey={t.key} form={f} />
    </div>
  );
}
