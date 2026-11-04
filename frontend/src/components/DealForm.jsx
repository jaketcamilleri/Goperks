import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/api";

const EMPTY = { title: "", business_name: "", category: "cafes", discount_label: "", description: "", terms: "", suburb: "", image_url: "", featured: false, est_saving: "" };

export function DealForm({ initial, onSubmit, submitLabel = "Submit deal", showFeatured = false, busy = false }) {
  const [f, setF] = useState({ ...EMPTY, ...(initial || {}) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const field = "mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white";

  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      data-testid="deal-form"
      onSubmit={(e) => { e.preventDefault(); onSubmit({ ...f, est_saving: Number(f.est_saving) || 0 }); }}
    >
      <div className="sm:col-span-2">
        <Label>Deal headline</Label>
        <Input required value={f.title} onChange={set("title")} placeholder="e.g. 2-for-1 coffees before 10am" className={field} data-testid="deal-form-title" />
      </div>
      <div>
        <Label>Business name</Label>
        <Input required value={f.business_name} onChange={set("business_name")} className={field} data-testid="deal-form-business" />
      </div>
      <div>
        <Label>Suburb</Label>
        <Input value={f.suburb} onChange={set("suburb")} className={field} data-testid="deal-form-suburb" />
      </div>
      <div>
        <Label>Category</Label>
        <select value={f.category} onChange={set("category")} className={`${field} w-full border px-3`} data-testid="deal-form-category">
          {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <Label>Discount badge</Label>
        <Input required value={f.discount_label} onChange={set("discount_label")} placeholder="e.g. 25% off" className={field} data-testid="deal-form-discount" />
      </div>
      <div className="sm:col-span-2">
        <Label>Description</Label>
        <Textarea required value={f.description} onChange={set("description")} className="mt-1.5 min-h-[96px] rounded-xl border-[#C2DEDA] bg-white" data-testid="deal-form-description" />
      </div>
      <div className="sm:col-span-2">
        <Label>Terms & conditions</Label>
        <Textarea value={f.terms} onChange={set("terms")} className="mt-1.5 min-h-[72px] rounded-xl border-[#C2DEDA] bg-white" data-testid="deal-form-terms" />
      </div>
      <div>
        <Label>Typical member saving (A$)</Label>
        <Input type="number" min="0" step="0.5" value={f.est_saving} onChange={set("est_saving")} placeholder="e.g. 8" className={field} data-testid="deal-form-saving" />
      </div>
      <div>
        <Label>Image URL</Label>
        <Input value={f.image_url} onChange={set("image_url")} placeholder="https://…" className={field} data-testid="deal-form-image" />
      </div>
      {showFeatured && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.featured} onChange={set("featured")} data-testid="deal-form-featured" /> Feature on homepage
        </label>
      )}
      <button disabled={busy} type="submit" data-testid="deal-form-submit"
        className="rounded-full bg-[#B9512E] px-8 py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
