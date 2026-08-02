import { motion, AnimatePresence } from "motion/react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

// Destructive action — use red as accent for the confirm button
const dangerStyle = {
  background: "var(--red)",
  color: "#fff",
  border: "none",
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onCancel}
          aria-modal="true"
          role="alertdialog"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-message"
        >
          <motion.div
            className="modal-surface"
            style={{ maxWidth: 400 }}
            initial={{ opacity: 0, y: 24, scale: 0.94, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(3px)" }}
            transition={{
              type: "spring",
              bounce: 0.15,
              duration: 0.4,
              layout: { type: "spring", bounce: 0, duration: 0.35 },
            }}
            layout
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning icon — uses color to telegraph consequence */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "var(--red-bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2
                  id="confirm-title"
                  className="mb-2"
                  style={{ fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.2 }}
                >
                  {title}
                </h2>
                <p
                  id="confirm-message"
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: 14,
                    lineHeight: 1.55,
                  }}
                >
                  {message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <motion.button
                className="apple-btn apple-btn-secondary"
                onClick={onCancel}
                disabled={isLoading}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", bounce: 0, duration: 0.14 }}
              >
                Cancel
              </motion.button>
              <motion.button
                className="apple-btn"
                onClick={onConfirm}
                disabled={isLoading}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", bounce: 0, duration: 0.14 }}
                style={{
                  ...dangerStyle,
                  opacity: isLoading ? 0.65 : 1,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  transition: "background 0.15s ease, opacity 0.15s ease",
                }}
              >
                {isLoading ? "Deleting..." : confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
