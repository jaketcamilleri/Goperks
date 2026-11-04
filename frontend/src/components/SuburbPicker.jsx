import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { api } from "@/lib/api";

let cache = null;
const loadSuburbs = () => {
  if (!cache) cache = api.get("/places/vic-suburbs").then((r) => (Array.isArray(r.data) ? r.data : [])).catch(() => { cache = null; return []; });
  return cache;
};

const search = (list, q) => {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const starts = [], has = [];
  for (const x of list) {
    const label = `${x.name} ${x.postcode}`.toLowerCase();
    if (label.startsWith(s) || x.postcode.startsWith(s)) starts.push(x);
    else if (label.includes(s)) has.push(x);
    if (starts.length >= 12) break;
  }
  return starts.concat(has).slice(0, 12);
};

/** Searchable Victorian suburb + postcode picker. onChange({ suburb, postcode }) — postcode is "" until a list item is picked. */
export function SuburbPicker({ suburb, postcode, onChange, id, className = "", testid = "suburb-picker", required = false, placeholder = "Start typing a suburb or postcode" }) {
  const [list, setList] = useState([]);
  const [text, setText] = useState(suburb ? `${suburb}${postcode ? ` ${postcode}` : ""}` : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef(null);

  useEffect(() => { let live = true; loadSuburbs().then((l) => { if (live) setList(l); }); return () => { live = false; }; }, []);
  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const matches = useMemo(() => search(list, text), [list, text]);
  const pick = (x) => { setText(`${x.name} ${x.postcode}`); setOpen(false); onChange({ suburb: x.name, postcode: x.postcode }); };
  const type = (e) => { setText(e.target.value); setOpen(true); setActive(0); onChange({ suburb: e.target.value.trim(), postcode: "" }); };
  const keys = (e) => {
    if (!open || !matches.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(matches[active]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={box} className="relative" data-testid={testid}>
      <input id={id} value={text} onChange={type} onFocus={() => setOpen(true)} onKeyDown={keys} required={required} autoComplete="off"
        placeholder={placeholder} role="combobox" aria-expanded={open} aria-autocomplete="list" className={className} data-testid={`${testid}-input`} />
      {open && matches.length > 0 && (
        <ul role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-[#C2DEDA] bg-white py-1 shadow-lg" data-testid={`${testid}-options`}>
          {matches.map((x, i) => (
            <li key={`${x.name}-${x.postcode}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(x)} onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === active ? "bg-[#EAF6F3]" : ""}`} data-testid={`${testid}-option-${x.postcode}-${x.name.replace(/\W+/g, "-").toLowerCase()}`}>
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9A4024]" /><span className="font-medium">{x.name}</span><span className="ml-auto font-mono text-xs text-[#3D5E65]">{x.postcode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {text && !postcode && !open && <p className="mt-1 text-xs text-[#9A4024]" data-testid={`${testid}-hint`}>Pick your suburb from the list so we have the postcode.</p>}
    </div>
  );
}
