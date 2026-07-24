import { type ReactNode, type FormEvent } from "react";
import { motion } from "motion/react";
import Modal from "./Modal";

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  title: string;
  saving?: boolean;
  error?: string;
  children: ReactNode;
  maxWidth?: number;
}

export default function FormModal({ open, onClose, onSubmit, title, saving, error, children, maxWidth }: FormModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={maxWidth}>
      <form onSubmit={onSubmit} className="space-y-5">
        {children}
        {error && <div className="apple-error">{error}</div>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="apple-btn apple-btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <motion.button type="submit" className="apple-btn apple-btn-primary" disabled={saving} whileTap={{ scale: 0.97 }}>
            {saving ? "Saving..." : "Save"}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
