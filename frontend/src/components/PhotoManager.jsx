import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { assetUrl } from "@/lib/site";

const MAX = 6;

export const PhotoManager = ({ user, setUser }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const photos = Array.isArray(user?.photos) ? user.photos : [];

  const pick = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX - photos.length);
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is over 5 MB`); continue; }
      const fd = new FormData();
      fd.append("file", file);
      try { const r = await api.post("/business/photos", fd); setUser(r.data); }
      catch (err) { toast.error(formatErr(err)); break; }
    }
    setBusy(false);
  };
  const remove = async (path) => {
    try { const r = await api.post("/business/photos/remove", { path }); setUser(r.data); }
    catch (err) { toast.error(formatErr(err)); }
  };

  return (
    <div className="sm:col-span-2" data-testid="photo-manager">
      <p className="font-semibold">Venue photos <span className="font-normal text-[#3D5E65]">(optional, up to {MAX})</span></p>
      <p className="text-sm text-[#3D5E65]">Shown on your deal pages. PNG, JPG or WebP, under 5 MB each. Photos save as soon as they upload.</p>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {photos.map((p, i) => (
          <div key={p.path} className="group relative aspect-square overflow-hidden rounded-2xl border border-[#C2DEDA] bg-white" data-testid={`photo-${i}`}>
            <img src={assetUrl(p.url)} alt={`Venue photo ${i + 1}`} className="h-full w-full object-cover" />
            <button type="button" onClick={() => remove(p.path)} aria-label="Remove photo" data-testid={`photo-remove-${i}`}
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#0F3138]/80 text-white transition-transform hover:scale-110">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {photos.length < MAX && (
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} data-testid="photo-add-btn"
            className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-[#C2DEDA] bg-white/60 text-[#3D5E65] transition-colors hover:border-[#17434C] hover:text-[#17434C] disabled:opacity-60">
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-xs font-semibold"><ImagePlus className="h-6 w-6" />Add</span>}
          </button>
        )}
      </div>
      <input ref={ref} type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={pick} className="hidden" data-testid="photo-input" />
    </div>
  );
};
