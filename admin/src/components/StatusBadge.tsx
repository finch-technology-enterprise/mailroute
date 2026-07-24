import { motion } from "motion/react";

interface StatusBadgeProps {
  enabled: boolean;
  onToggle?: () => void;
}

export default function StatusBadge({ enabled, onToggle }: StatusBadgeProps) {
  return (
    <motion.button
      className={`apple-badge ${enabled ? "apple-badge-enabled" : "apple-badge-disabled"}`}
      onClick={onToggle}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", bounce: 0, duration: 0.12 }}
      style={{ fontSize: 12 }}
    >
      <motion.span
        layout
        transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
        style={{
          display: "inline-block",
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: enabled ? "var(--green)" : "var(--text-tertiary)",
        }}
      />
      {enabled ? "Enabled" : "Disabled"}
    </motion.button>
  );
}
