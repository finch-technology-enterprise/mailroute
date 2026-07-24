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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="modal-overlay"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            className="modal-surface"
            style={{ maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="mb-2 text-xl"
              style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              {title}
            </h2>
            <p
              className="mb-8"
              style={{
                color: "var(--text-secondary)",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {message}
            </p>
            <div className="flex justify-end gap-3">
              <motion.button
                className="apple-btn apple-btn-secondary"
                onClick={onCancel}
                disabled={isLoading}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", bounce: 0, duration: 0.12 }}
              >
                Cancel
              </motion.button>
              <motion.button
                className="apple-btn apple-btn-danger"
                onClick={onConfirm}
                disabled={isLoading}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", bounce: 0, duration: 0.12 }}
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
