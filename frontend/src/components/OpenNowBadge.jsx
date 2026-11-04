export const OpenNowBadge = ({ className = "", testId = "open-now-badge" }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full bg-[#EBF3EC] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#2F5A3A] ${className}`} data-testid={testId}>
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4E7A58] opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4E7A58]" />
    </span>
    Open now
  </span>
);
