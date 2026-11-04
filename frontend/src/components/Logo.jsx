export function LogoMark({ className = "h-8 w-auto" }) {
  return <img src="/brand/local-perks-mark.png" alt="" aria-hidden="true" className={`${className} select-none`} draggable="false" />;
}

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="Local Perks">
      <LogoMark className="h-9 w-auto" />
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? "text-[#FBF8F3]" : "text-[#1B4D57]"}`}>
        Local <span className="text-[#D95329]">Perks</span>
      </span>
    </span>
  );
}
