import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageUp, X } from "lucide-react";
import { api, formatErr } from "@/lib/api";

/** Upload one photo to `endpoint`; onChange receives the stored image link ("" when removed). */
export function ImageUpload({ value, onChange, endpoint, testid = "image-upload", hint = "PNG, JPG or WebP under 5 MB." }) {
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
    try { const { data } = await api.post(endpoint, fd); onChange(data?.url || ""); toast.success("Photo uploaded"); }
    catch (err) { toast.error(formatErr(err)); } finally { setBusy(false); }
  };
  return (
    <div data-testid={testid}>
      <div className="mt-1.5 flex items-center gap-3">
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-dashed border-[#C2DEDA] bg-[#F7FBFA]">
          {value ? <img src={value} alt="Deal" className="h-full w-full object-cover" data-testid={`${testid}-thumb`} />
            : <ImageUp className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[#9FBFBC]" />}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid={`${testid}-btn`}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#C2DEDA] bg-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#EAF6F3] disabled:opacity-60">
            <ImageUp className="h-4 w-4" /> {busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}</button>
          {value && <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs font-semibold text-[#9A4024] hover:underline" data-testid={`${testid}-remove`}><X className="h-3.5 w-3.5" /> Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden" data-testid={`${testid}-file`} />
      </div>
      <p className="mt-1 text-xs text-[#3D5E65]">{hint}</p>
    </div>
  );
}
