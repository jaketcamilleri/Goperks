/** Decorative, playful shapes (stars, squiggles, dots). Purely visual: aria-hidden and pointer-events-none. */
const Star = ({ c }) => <svg viewBox="0 0 24 24" className="h-full w-full"><path fill={c} d="M12 1.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 8.7l7.1-.6z" /></svg>;
const Squiggle = ({ c }) => <svg viewBox="0 0 60 16" className="h-full w-full"><path d="M2 8c6-8 10 8 16 0s10 8 16 0 10 8 16 0 6 4 8 2" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" /></svg>;
const Dot = ({ c }) => <svg viewBox="0 0 10 10" className="h-full w-full"><circle cx="5" cy="5" r="5" fill={c} /></svg>;
const SHAPES = { star: Star, squiggle: Squiggle, dot: Dot };

/** items: [shape, colour, tailwind position/size classes, rotation deg] */
export function Confetti({ items, className = "" }) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      {items.map(([shape, c, pos, r = 0], i) => {
        const S = SHAPES[shape];
        return <span key={i} className={`float-y absolute ${pos}`} style={{ "--r": `${r}deg`, animationDelay: `${i * 0.6}s` }}><S c={c} /></span>;
      })}
    </div>
  );
}

/** Thin multi-colour strip, used under headers and above footers. */
export const RainbowBar = ({ className = "h-1.5" }) => <div className={`rainbow-bar w-full ${className}`} aria-hidden="true" />;

/** Hand-drawn underline that sits under a highlighted word. */
export function Underline({ children, color = "#FFD166" }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span className="relative z-10">{children}</span>
      <svg viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-1 left-0 z-0 h-3 w-full" aria-hidden="true">
        <path d="M3 9c40-6 90-8 194-3" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      </svg>
    </span>
  );
}
