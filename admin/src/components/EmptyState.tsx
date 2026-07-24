import { motion } from "motion/react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="card flex flex-col items-center justify-center px-8 py-20 text-center"
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          background: "var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
          fontSize: 20,
        }}
      >
        +
      </div>
      <h3 className="mb-2 text-lg" style={{ fontWeight: 600 }}>
        {title}
      </h3>
      <p
        className="mb-6 max-w-sm"
        style={{
          color: "var(--text-secondary)",
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
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
