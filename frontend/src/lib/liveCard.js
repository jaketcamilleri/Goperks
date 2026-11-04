import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/** Rotating signed card code + ticking clock, so a screenshot is easy to spot and won't scan. */
export function useLiveCard(enabled) {
  const [token, setToken] = useState(null);
  const [refreshAt, setRefreshAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await api.get("/me/live-card");
        if (cancelled) return;
        setToken(data?.token || null);
        const secs = Number(data?.refresh_in) || 30;
        setRefreshAt(Date.now() + secs * 1000);
        timer = setTimeout(load, secs * 1000 + 300);
      } catch {
        if (!cancelled) { setToken(null); timer = setTimeout(load, 10000); }
      }
    };
    load();
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); load(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [enabled]);

  const left = Math.max(0, Math.ceil((refreshAt - now) / 1000));
  return { token, left, now };
}
