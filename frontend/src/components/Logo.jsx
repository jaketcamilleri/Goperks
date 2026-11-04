export function LogoMark({ className = "h-8 w-auto" }) {
  return <img src="/brand/local-perks-mark.png" alt="" aria-hidden="true" className={`${className} select-none`} draggable="false" />;
}

export function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5" aria-label="Local Perks">
      <LogoMark className="h-9 w-auto" />
      <span className={`font-display text-xl font-extrabold tracking-tight ${light ? "text-[#EAF6F3]" : "text-[#17434C]"}`}>
        Local <span className="text-[#B9512E]">Perks</span>
      </span>
    </span>
  );
}
