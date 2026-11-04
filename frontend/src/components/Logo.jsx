export function LogoMark({ className = "w-9 h-9" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#D95329" />
      <path d="M14 22a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v5a5 5 0 0 0 0 10v5a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4v-5a5 5 0 0 0 0-10z" fill="#FBF8F3" />
      <path d="M32 40.5l-6.2-6a3.9 3.9 0 0 1 5.5-5.6l.7.7.7-.7a3.9 3.9 0 0 1 5.5 5.6z" fill="#D95329" />
      <circle cx="44" cy="20" r="2.4" fill="#F3A72E" />
    </svg>
  );
}

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className={`font-display text-xl font-semibold tracking-tight ${light ? "text-[#FBF8F3]" : "text-[#1E2229]"}`}>
        Tiny's <em className="font-normal italic text-[#D95329]">Vouchers</em>
      </span>
    </span>
  );
}
