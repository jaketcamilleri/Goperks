import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useFavorites } from "@/context/FavoritesContext";
import { DealCard } from "@/components/DealCard";

export function SavedDeals() {
  const { version } = useFavorites();
  const [deals, setDeals] = useState(null);

  useEffect(() => {
    api.get("/me/favorites").then((r) => setDeals(Array.isArray(r.data) ? r.data : [])).catch(() => setDeals([]));
  }, [version]);

  return (
    <section className="mt-20" data-testid="saved-deals">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Saved <em className="font-normal italic text-[#B9512E]">favourites</em></h2>
        <span className="font-mono text-xs uppercase tracking-widest text-[#3D5E65]" data-testid="saved-deals-count">{deals?.length ?? 0} saved</span>
      </div>
      {deals && deals.length === 0 ? (
        <p className="mt-6 rounded-[24px] border border-dashed border-[#C2DEDA] p-8 text-[#3D5E65]" data-testid="saved-deals-empty">
          Tap the heart on any deal to keep it here. <Link to="/deals" className="font-semibold text-[#9A4024]">Browse deals →</Link>
        </p>
      ) : (
        <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3" data-testid="saved-deals-grid">
          {(deals || []).map((d, i) => <DealCard key={d.id} deal={d} index={i} />)}
        </div>
      )}
    </section>
  );
}
