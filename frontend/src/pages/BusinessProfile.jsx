import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/Reveal";
import { bp, assetUrl } from "@/lib/site";

const field = "mt-1.5 h-12 rounded-xl border-[#C2DEDA] bg-white";
const area = "mt-1.5 min-h-[96px] rounded-xl border-[#C2DEDA] bg-white";
const KEYS = ["business_name", "address", "suburb", "phone", "website", "instagram", "opening_hours", "about"];

function LogoPicker({ user, setUser }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Logo must be under 3 MB"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try { const r = await api.post("/business/logo", fd); setUser(r.data); toast.success("Logo uploaded"); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-5 sm:col-span-2" data-testid="profile-logo">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[22px] border border-[#C2DEDA] bg-white">
        {user?.logo_url ? <img src={assetUrl(user.logo_url)} alt="Business logo" className="h-full w-full object-contain" data-testid="profile-logo-img" />
          : <ImagePlus className="h-7 w-7 text-[#3D5E65]" />}
      </div>
      <div>
        <p className="font-semibold">Logo <span className="font-normal text-[#3D5E65]">(optional)</span></p>
        <p className="text-sm text-[#3D5E65]">PNG, JPG or WebP, under 3 MB. Square works best.</p>
        <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} className="hidden" data-testid="profile-logo-input" />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} data-testid="profile-logo-btn"
          className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#17434C] px-5 py-2 text-sm font-semibold transition-colors hover:bg-[#17434C] hover:text-[#EAF6F3] disabled:opacity-60">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{user?.logo_url ? "Change logo" : "Upload logo"}
        </button>
      </div>
    </div>
  );
}

function Field({ k, label, f, set, hint, required = true, ...rest }) {
  return (
    <div>
      <Label htmlFor={`pf-${k}`}>{label}{!required && <span className="font-normal text-[#3D5E65]"> (optional)</span>}</Label>
      <Input id={`pf-${k}`} required={required} value={f[k]} onChange={set(k)} className={field} data-testid={`profile-${k}-input`} {...rest} />
      {hint && <p className="mt-1 text-xs text-[#3D5E65]">{hint}</p>}
    </div>
  );
}

export default function BusinessProfile() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState(() => Object.fromEntries(KEYS.map((k) => [k, user?.[k] || ""])));
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const first = !user?.profile_complete;

  if (user?.role !== "business" || user?.business_status !== "approved") {
    return <p className="mx-auto max-w-3xl px-5 py-24 text-[#3D5E65]" data-testid="profile-not-approved">Your business profile opens once your partner account is approved.</p>;
  }

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.put("/business/profile", { ...f, website: f.website || null, instagram: f.instagram || null });
      setUser(r.data);
      toast.success(first ? "Profile complete — your portal is unlocked" : "Profile saved");
      nav(bp(""));
    } catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pb-28 pt-14 sm:px-8" data-testid="business-profile-page">
      <Eyebrow>{first ? "One last step" : "Business profile"}</Eyebrow>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{first ? "Tell members about you" : "Your business profile"}</h1>
      <p className="mt-3 max-w-xl text-[#3D5E65]">Members see these details on your deal pages. {first && "Fill them in to unlock your partner portal."}</p>
      <form onSubmit={save} className="mt-10 grid gap-5 rounded-[32px] border border-[#C2DEDA] bg-white/60 p-6 sm:grid-cols-2 sm:p-8" data-testid="business-profile-form">
        <LogoPicker user={user} setUser={setUser} />
        <div className="sm:col-span-2"><Field k="business_name" label="Business name" f={f} set={set} maxLength={120} /></div>
        <Field k="address" label="Street address" f={f} set={set} placeholder="12 Sydney Rd" maxLength={200} autoComplete="street-address" />
        <Field k="suburb" label="Suburb" f={f} set={set} placeholder="Brunswick" maxLength={80} />
        <Field k="phone" label="Phone" f={f} set={set} type="tel" placeholder="03 9000 0000" minLength={6} maxLength={30} />
        <Field k="website" label="Website" f={f} set={set} required={false} placeholder="yourbusiness.com.au" maxLength={200} />
        <Field k="instagram" label="Instagram" f={f} set={set} required={false} placeholder="@yourbusiness" maxLength={60} />
        <div className="sm:col-span-2">
          <Label htmlFor="pf-hours">Opening hours</Label>
          <Textarea id="pf-hours" required minLength={3} maxLength={600} value={f.opening_hours} onChange={set("opening_hours")} placeholder={"Mon–Fri 7am–3pm\nSat–Sun 8am–2pm"} className={area} data-testid="profile-opening_hours-input" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pf-about">Short description</Label>
          <Textarea id="pf-about" required minLength={10} maxLength={600} value={f.about} onChange={set("about")} placeholder="What makes your place special, in a sentence or two." className={area} data-testid="profile-about-input" />
          <p className="mt-1 text-xs text-[#3D5E65]">{f.about.length}/600</p>
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
          <button disabled={busy} type="submit" data-testid="profile-save-btn"
            className="rounded-full bg-[#B9512E] px-8 py-4 font-semibold text-[#EAF6F3] transition-[background-color,transform] hover:bg-[#9A4024] active:scale-[0.98] disabled:opacity-60">
            {busy ? "Saving…" : first ? "Save and unlock portal" : "Save profile"}
          </button>
          {!first && <Link to={bp("")} className="text-center text-sm font-semibold text-[#9A4024]" data-testid="profile-cancel-link">Back to portal</Link>}
        </div>
      </form>
    </div>
  );
}
