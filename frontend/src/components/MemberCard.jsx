import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { LogoMark } from "@/components/Logo";

function Barcode({ value = "TV-000000" }) {
  const bars = Array.from(value.repeat(3)).map((ch, i) => ((ch.charCodeAt(0) + i) % 4) + 1);
  let x = 0;
  return (
    <svg viewBox="0 0 160 36" className="h-9 w-full" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((w, i) => {
        const rect = i % 2 === 0 ? <rect key={i} x={x} y="0" width={w} height="36" fill="#1E2229" /> : null;
        x += w + 1;
        return rect;
      })}
    </svg>
  );
}

export function MemberCard({ name = "Your Name", code = "TV-XXXXXX", expires, status = "preview", className = "" }) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [14, -14]), { stiffness: 160, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-18, 18]), { stiffness: 160, damping: 18 });
  const glareX = useTransform(mx, [-0.5, 0.5], ["0%", "100%"]);

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const reset = () => { mx.set(0); my.set(0); };
  const active = status === "active";

  return (
    <div className={`[perspective:1200px] ${className}`} onPointerMove={onMove} onPointerLeave={reset} data-testid="member-card">
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative aspect-[1.586/1] w-full overflow-hidden rounded-[22px] bg-[#1E2229] p-5 text-[#FBF8F3] shadow-[0_40px_80px_-30px_rgba(30,34,41,0.6)] sm:p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#D95329]" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-48 w-48 rounded-full bg-[#F3A72E]/90" />
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)", backgroundSize: "200% 100%", backgroundPositionX: glareX }}
        />
        <div className="relative flex h-full flex-col justify-between" style={{ transform: "translateZ(40px)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <LogoMark className="h-8 w-8" />
              <span className="font-display text-lg font-semibold">Tiny's Club</span>
            </div>
            <span
              data-testid="member-card-status"
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${active ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#FBF8F3] text-[#1E2229]"}`}
            >
              {active ? "Active" : status === "expired" ? "Expired" : "Member"}
            </span>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold leading-tight sm:text-3xl" data-testid="member-card-name">{name}</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#E5DEC9]">Member no.</p>
                <p className="font-mono text-sm font-bold sm:text-base" data-testid="member-card-code">{code}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#E5DEC9]">Valid until</p>
                <p className="font-mono text-sm font-bold sm:text-base">{expires || "12 months"}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-[#FBF8F3] px-3 py-1.5">
              <Barcode value={code} />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
