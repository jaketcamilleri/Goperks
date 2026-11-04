import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const FavCtx = createContext({ ids: new Set(), toggle: () => {}, version: 0 });

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [version, setVersion] = useState(0);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    api.get("/me/favorite-ids").then((r) => setIds(new Set(Array.isArray(r.data) ? r.data : []))).catch(() => setIds(new Set()));
  }, [user]);

  const toggle = useCallback(async (dealId) => {
    if (!user) { nav(`/login?next=/deals/${dealId}`); return; }
    try {
      const { data } = await api.post(`/me/favorites/${dealId}`);
      setIds((prev) => {
        const next = new Set(prev);
        if (data?.favorited) next.add(dealId); else next.delete(dealId);
        return next;
      });
      setVersion((v) => v + 1);
      toast.success(data?.favorited ? "Saved to your favourites" : "Removed from favourites");
    } catch (e) {
      toast.error(formatErr(e));
    }
  }, [user, nav]);

  return <FavCtx.Provider value={{ ids, toggle, version }}>{children}</FavCtx.Provider>;
}

export const useFavorites = () => useContext(FavCtx);
