import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CATEGORIES } from "@/lib/api";
import { toast } from "sonner";
import { SuburbPicker } from "@/components/SuburbPicker";
import { ImageUpload } from "@/components/ImageUpload";

const EMPTY = { title: "", business_name: "", partner_id: "", category: "cafes", discount_label: "", description: "", terms: "", suburb: "", image_url: "", featured: false, holiday_pick: false, est_saving: "", ends_on: "" };

function BusinessField({ partners, lockedBusiness, f, setF, field }) {
  if (partners) {
    const pick = (e) => {
      const p = partners.find((x) => x.id === e.target.value);
      setF({ ...f, partner_id: e.target.value, business_name: p?.business_name || "", suburb: f.suburb || p?.suburb || "", postcode: f.suburb ? f.postcode : p?.postcode || "" });
    };
    return (
      <div>
        <Label>Business</Label>
        <select required value={f.partner_id} onChange={pick} className={`${field} w-full border px-3`} data-testid="deal-form-partner">
          <option value="" disabled>Choose a partner business…</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.business_name || p.name}{p.suburb ? ` — ${p.suburb}` : ""}</option>)}
        </select>
        {partners.length === 0 && <p className="mt-1 text-xs text-[#9A4024]">No approved businesses yet — add or approve one first.</p>}
      </div>
    );
  }
  return (
    <div>
      <Label>Business</Label>
      <p className={`${field} flex items-center border bg-[#F3F8F7] px-3 text-sm`} data-testid="deal-form-business-locked">{lockedBusiness}</p>
    </div>
  );
}

export function DealForm({ initial, onSubmit, submitLabel = "Submit deal", showFeatured = false, busy = false, partners, lockedBusiness }) {
  const [f, setF] = useState({ ...EMPTY, ...(initial || {}), partner_id: initial?.submitted_by && partners?.some((p) => p.id === initial.submitted_by) ? initial.submitted_by : "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const field = "mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white";

  return (
    <form
      className="grid gap-5 sm:grid-cols-2"
      data-testid="deal-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.suburb && !f.postcode && f.suburb !== (initial?.suburb || "")) { toast.error("Pick the suburb from the list"); return; }
        const { postcode, ...rest } = f;
        onSubmit({ ...rest, partner_id: f.partner_id || null, ends_on: f.ends_on || null, est_saving: Number(f.est_saving) || 0 });
      }}
    >
      <div className="sm:col-span-2">
        <Label>Deal headline</Label>
        <Input required value={f.title} onChange={set("title")} placeholder="e.g. 2-for-1 coffees before 10am" className={field} data-testid="deal-form-title" />
      </div>
      <BusinessField partners={partners} lockedBusiness={lockedBusiness} f={f} setF={setF} field={field} />
      <div>
        <Label htmlFor="deal-suburb">Suburb</Label>
        <SuburbPicker key={f.partner_id || "own"} id="deal-suburb" suburb={f.suburb} postcode={f.postcode} testid="deal-form-suburb"
          className={`${field} flex w-full border px-3 text-sm outline-none focus:border-[#17434C]`} placeholder="Suburb or postcode"
          onChange={({ suburb, postcode }) => setF((cur) => ({ ...cur, suburb, postcode }))} />
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
        <Label>Offer ends <span className="font-normal text-[#3D5E65]">(optional)</span></Label>
        <Input type="date" value={f.ends_on || ""} min={new Date().toLocaleDateString("en-CA")} onChange={set("ends_on")} className={field} data-testid="deal-form-ends-on" />
        <p className="mt-1 text-xs text-[#3D5E65]">Leave blank for an ongoing deal. It shows as “Ending soon” in the last 14 days.</p>
      </div>
      <div>
        <Label>Deal photo</Label>
        <ImageUpload value={f.image_url} endpoint="/deals/image" testid="deal-form-image" hint="PNG, JPG or WebP under 5 MB. A landscape photo of the food or place works best."
          onChange={(image_url) => setF((cur) => ({ ...cur, image_url }))} />
      </div>
      {showFeatured && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={f.featured} onChange={set("featured")} data-testid="deal-form-featured" /> Feature on homepage
        </label>
      )}
      {showFeatured && (
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={!!f.holiday_pick} onChange={set("holiday_pick")} className="mt-0.5" data-testid="deal-form-holiday-pick" />
          <span>School holiday pick<span className="block text-xs text-[#3D5E65]">Shows in the “School holiday picks” row on the home page, only during Victorian school holidays.</span></span>
        </label>
      )}
      <button disabled={busy} type="submit" data-testid="deal-form-submit"
        className="rounded-full bg-[#B9512E] px-8 py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
