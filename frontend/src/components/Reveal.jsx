import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];

export function MaskLines({ lines, className = "", delay = 0.15, as: Tag = "h1", testId }) {
  return (
    <Tag className={className} data-testid={testId}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em]">
          <motion.span
            className="block"
            initial={{ y: "105%" }}
            animate={{ y: "0%" }}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * 0.12 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

export function FadeUp({ children, delay = 0, className = "", y = 28 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className = "" }) {
  return (
    <p className={`font-mono text-xs uppercase tracking-[0.22em] text-[#B63F18] ${className}`}>
      <span className="mr-2 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[#D95329]" />
      {children}
    </p>
  );
}
