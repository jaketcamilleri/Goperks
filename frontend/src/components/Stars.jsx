import { useState } from "react";
import { Star } from "lucide-react";

export function Stars({ value = 0, size = "h-4 w-4", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className={`relative inline-block ${size}`}>
            <Star className={`absolute inset-0 ${size} text-[#C2DEDA]`} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={`${size} text-[#E39A2D]`} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function RatingChip({ deal, testId }) {
  if (!deal?.rating_count) return <span className="text-xs font-semibold text-[#3D5E65]" data-testid={testId}>No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm" data-testid={testId}>
      <Stars value={deal.rating_avg} size="h-3.5 w-3.5" />
      <span className="font-bold text-[#17434C]">{deal.rating_avg.toFixed(1)}</span>
      <span className="text-[#3D5E65]">({deal.rating_count})</span>
    </span>
  );
}

export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const labels = ["", "Not great", "OK", "Good", "Great", "Loved it"];
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3" data-testid="star-input">
      <div className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} onMouseEnter={() => setHover(i)} aria-label={`${i} star${i > 1 ? "s" : ""}`}
            className="p-1 transition-transform hover:scale-110" data-testid={`star-input-${i}`}>
            <Star className={`h-8 w-8 ${i <= shown ? "text-[#E39A2D]" : "text-[#C2DEDA]"}`} fill="currentColor" strokeWidth={0} />
          </button>
        ))}
      </div>
      <span className="text-sm font-semibold text-[#3D5E65]">{labels[shown]}</span>
    </div>
  );
}
