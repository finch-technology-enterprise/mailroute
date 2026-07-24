import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="flex flex-col items-center justify-center px-8 py-20 text-center"
      style={{ minHeight: 300 }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          background: "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          fontSize: 24,
          color: "var(--text-tertiary)",
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>{title}</h3>
      <p className="mb-6 max-w-sm" style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>{description}</p>
      {actionLabel && onAction && (
        <motion.button
          className="apple-btn apple-btn-primary"
          onClick={onAction}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", bounce: 0, duration: 0.12 }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
