import { type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: number;
}

export default function Modal({ open, onClose, children, title, maxWidth = 520 }: ModalProps) {
  // Dismiss on Escape key — Apple Human Interface Guidelines
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-labelledby={title ? "modal-title" : undefined}
        >
          {/* Stack a second layer of translucency behind the sheet so stacked modals dim progressively */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.08)",
              pointerEvents: "none",
            }}
          />
          <motion.div
            className="modal-surface"
            style={{ maxWidth }}
            initial={{ opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(2px)" }}
            transition={{
              type: "spring",
              bounce: 0.18,
              duration: 0.38,
              layout: { type: "spring", bounce: 0, duration: 0.35 },
            }}
            layout
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <h2 id="modal-title" className="mb-6">
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
