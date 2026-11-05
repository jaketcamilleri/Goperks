import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Logo } from "@/components/Logo";
import { QRCodeSVG } from "qrcode.react";
import { useLiveCard } from "@/lib/liveCard";

function LiveStrip({ now, left }) {
  const time = new Date(now).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", second: "2-digit" });
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-2 rounded-b-[22px] bg-[#0F3138]/85 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#EAF6F3] backdrop-blur" data-testid="member-card-live">
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7FD1B9]" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#7FD1B9]" /></span>
        Live card
      </span>
      <span data-testid="member-card-clock">{time}</span>
      <span className="text-[#C2DEDA]" data-testid="member-card-refresh">new code {left}s</span>
    </div>
  );
}

export function MemberCard({ name = "Your Name", code = "GP-XXXXXX", expires, status = "preview", className = "", live = false }) {
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
  const validCode = /^(GP|LP|TV)-[A-Z0-9]{6}$/.test(code || "");
  const liveOn = live && active && validCode;
  const { token, left, now } = useLiveCard(liveOn);

  return (
    <div className={`[perspective:1200px] ${className}`} onPointerMove={onMove} onPointerLeave={reset} data-testid="member-card">
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="relative grid w-full grid-cols-[minmax(0,1fr)] rounded-[22px] bg-[#4CC9F0] text-[#0F3138] shadow-[0_40px_80px_-30px_rgba(30,34,41,0.6)]"
      >
        {/* Decorations are clipped in their own layer so the card itself can grow taller if its contents need room. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[22px]" aria-hidden="true">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#FFD166]" />
          <div className="absolute -bottom-24 right-10 h-48 w-48 rounded-full bg-[#70E000]/90" />
          <motion.div
            className="absolute inset-0 opacity-40 mix-blend-overlay"
            style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)", backgroundSize: "200% 100%", backgroundPositionX: glareX }}
          />
          {liveOn && <div className="live-sheen absolute inset-0" />}
        </div>
        {/* Spacer keeps the bank-card shape; the content shares its grid cell, so a cramped card grows instead of clipping. */}
        <div className="col-start-1 row-start-1 aspect-[1.586/1]" aria-hidden="true" />
        <div className={`relative col-start-1 row-start-1 flex min-w-0 flex-col justify-between gap-3 p-5 sm:p-6 ${liveOn ? "pb-12 sm:pb-12" : ""}`} style={{ transform: "translateZ(40px)" }}>
          <div className="flex items-start justify-between gap-2">
            <Logo className="h-7 w-auto shrink-0" />
            <span
              data-testid="member-card-status"
              className={`shrink-0 rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${active ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-white text-[#17434C]"}`}
            >
              {active ? "Active" : status === "expired" ? "Expired" : "Member"}
            </span>
          </div>
          <div>
            <p className="break-words font-display text-2xl font-semibold leading-tight" data-testid="member-card-name">{name}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[#17434C]">Member no.</p>
                <p className="font-mono text-sm font-bold" data-testid="member-card-code">{code}</p>
                <p className="mt-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#17434C]">Valid until</p>
                <p className="font-mono text-sm font-bold">{expires || "12 months"}</p>
              </div>
              {active && validCode && (
                <div className="shrink-0 rounded-xl bg-white p-1.5" data-testid="member-card-qr" data-live={liveOn && token ? "true" : "false"}>
                  <QRCodeSVG value={liveOn && token ? token : code} size={76} level="M" fgColor="#17434C" />
                </div>
              )}
            </div>
          </div>
        </div>
        {liveOn && <LiveStrip now={now} left={left} />}
      </motion.div>
    </div>
  );
}
