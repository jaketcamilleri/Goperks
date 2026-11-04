import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { LogoMark } from "@/components/Logo";
import { QRCodeSVG } from "qrcode.react";

export function MemberCard({ name = "Your Name", code = "GP-XXXXXX", expires, status = "preview", className = "" }) {
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
        className="relative aspect-[1.586/1] w-full overflow-hidden rounded-[22px] bg-[#17434C] p-5 text-[#EAF6F3] shadow-[0_40px_80px_-30px_rgba(30,34,41,0.6)] sm:p-6"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#B9512E]" />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-48 w-48 rounded-full bg-[#EE8A63]/90" />
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-overlay"
          style={{ background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.8) 50%, transparent 70%)", backgroundSize: "200% 100%", backgroundPositionX: glareX }}
        />
        <div className="relative flex h-full flex-col justify-between" style={{ transform: "translateZ(40px)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <LogoMark className="h-7 w-auto" />
              <span className="font-display text-lg font-extrabold">Go Perks</span>
            </div>
            <span
              data-testid="member-card-status"
              className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest ${active ? "bg-[#EBF3EC] text-[#2F5A3A]" : "bg-[#EAF6F3] text-[#17434C]"}`}
            >
              {active ? "Active" : status === "expired" ? "Expired" : "Member"}
            </span>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold leading-tight sm:text-3xl" data-testid="member-card-name">{name}</p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-[#C2DEDA]">Member no.</p>
                <p className="font-mono text-sm font-bold sm:text-base" data-testid="member-card-code">{code}</p>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-widest text-[#C2DEDA]">Valid until</p>
                <p className="font-mono text-sm font-bold sm:text-base">{expires || "12 months"}</p>
              </div>
              {active && /^(GP|LP|TV)-[A-Z0-9]{6}$/.test(code || "") && (
                <div className="rounded-xl bg-white p-1.5" data-testid="member-card-qr">
                  <QRCodeSVG value={code} size={84} level="M" fgColor="#17434C" />
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
