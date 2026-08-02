import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, bounce: 0.1, duration: 0.45 },
  },
};

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center px-8 py-20 text-center"
      style={{ minHeight: 300 }}
    >
      {/* Icon container — gentle scale-in with overshoot */}
      <motion.div
        variants={itemVariants}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          background: "var(--bg-tertiary)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          color: "var(--text-tertiary)",
          boxShadow: "var(--shadow-sm)",
        }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </motion.div>

      {/* Title */}
      <motion.h3 variants={itemVariants} className="mb-2" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em" }}>
        {title}
      </motion.h3>

      {/* Description */}
      <motion.p variants={itemVariants} className="mb-8" style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.55, maxWidth: 320 }}>
        {description}
      </motion.p>

      {/* Action button */}
      {actionLabel && onAction && (
        <motion.button
          variants={itemVariants}
          className="apple-btn apple-btn-primary"
          onClick={onAction}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.15 }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
