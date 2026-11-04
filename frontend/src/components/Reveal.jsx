import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1];

export function MaskLines({ lines, className = "", delay = 0.05, as: Tag = "h1", testId }) {
  return (
    <Tag className={className} data-testid={testId}>
      {lines.map((line, i) => (
        <motion.span
          key={i}
          className="block"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE, delay: delay + i * 0.06 }}
        >
          {line}
        </motion.span>
      ))}
    </Tag>
  );
}

export function FadeUp({ children, delay = 0, className = "", y = 16 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Eyebrow({ children, className = "" }) {
  return (
    <p className={`font-mono text-xs uppercase tracking-[0.22em] text-[#9A4024] ${className}`}>
      <span className="mr-2 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-[#B9512E]" />
      {children}
    </p>
  );
}
