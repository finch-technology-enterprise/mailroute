import { useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

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
  const shouldReduce = useReducedMotion();
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={messageId}
      initialFocusRef={cancelRef}
      maxWidth={400}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--red-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--red)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h2
            id={titleId}
            className="mb-2"
            style={{
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h2>
          <p
            id={messageId}
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
          ref={cancelRef}
          className="apple-btn apple-btn-secondary"
          onClick={onCancel}
          disabled={isLoading}
          whileTap={{ scale: shouldReduce ? 1 : 0.96 }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: shouldReduce ? 0 : 0.14,
          }}
        >
          Cancel
        </motion.button>
        <motion.button
          className="apple-btn"
          onClick={onConfirm}
          disabled={isLoading}
          whileTap={{ scale: shouldReduce ? 1 : 0.96 }}
          transition={{
            type: "spring",
            bounce: 0,
            duration: shouldReduce ? 0 : 0.14,
          }}
          style={{
            ...dangerStyle,
            opacity: isLoading ? 0.65 : 1,
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: shouldReduce
              ? "none"
              : "background 0.15s ease, opacity 0.15s ease",
          }}
        >
          {isLoading ? "Deleting..." : confirmLabel}
        </motion.button>
      </div>
    </Modal>
  );
}
