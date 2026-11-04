import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";

export function HeartButton({ dealId, className = "" }) {
  const { ids, toggle } = useFavorites();
  const on = ids.has(dealId);
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.8 }}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(dealId); }}
      aria-label={on ? "Remove from favourites" : "Save to favourites"}
      aria-pressed={on}
      data-testid={`favorite-btn-${dealId}`}
      className={`grid h-11 w-11 place-items-center rounded-full bg-[#FBF8F3]/90 shadow-lg backdrop-blur-md transition-colors hover:bg-[#FBF8F3] ${className}`}
    >
      <motion.span key={on ? "on" : "off"} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 12 }}>
        <Heart className={`h-5 w-5 ${on ? "fill-[#D95329] text-[#D95329]" : "text-[#1E2229]"}`} />
      </motion.span>
    </motion.button>
  );
}
