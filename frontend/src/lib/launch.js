import { useEffect, useState } from "react";
import { api } from "@/lib/api";

let cached = null;

/** Public launch-week offer ({ active, ends_on, price }) or { active: false } if none / backend unreachable. */
export function useLaunchOffer() {
  const [offer, setOffer] = useState({ active: false });
  useEffect(() => {
    let live = true;
    cached = cached || api.get("/launch-offer").then((r) => r.data || { active: false }).catch(() => ({ active: false }));
    cached.then((o) => { if (live) setOffer(o?.active ? o : { active: false }); });
    return () => { live = false; };
  }, []);
  return offer;
}

export const endsLabel = (iso) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }) : "";
