import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

// Stagger children — enter delay based on position in stack
const staggerChildren = {
  hidden: { opacity: 0 },
  visible: (i: number) => ({
    opacity: 1,
    transition: {
      delay: i * 0.05,
      type: "spring" as const,
      bounce: 0,
      duration: 0.35,
    },
  }),
};

const toastColors = {
  success: { bg: "#34c759", icon: "✓" },
  error: { bg: "#ff3b30", icon: "✕" },
  info: { bg: "#0071e3", icon: "ℹ" },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [politeAnnouncement, setPoliteAnnouncement] = useState({
    id: -1,
    message: "",
  });
  const [assertiveAnnouncement, setAssertiveAnnouncement] = useState({
    id: -1,
    message: "",
  });
  const shouldReduce = useReducedMotion();

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type === "error") setAssertiveAnnouncement({ id, message });
    else setPoliteAnnouncement({ id, message });
    // Slightly longer duration for readability
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        role="status"
        aria-atomic="true"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <span key={politeAnnouncement.id}>{politeAnnouncement.message}</span>
      </div>
      <div
        role="alert"
        aria-atomic="true"
        style={{
          position: "fixed",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <span key={assertiveAnnouncement.id}>
          {assertiveAnnouncement.message}
        </span>
      </div>
      {createPortal(
        <div
          className="toast-container"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 100,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <AnimatePresence mode="popLayout">
            {toasts.map((t, i) => {
              const colors = toastColors[t.type];
              return (
                <motion.div
                  key={t.id}
                  layout={!shouldReduce}
                  initial={
                    shouldReduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: -16, scale: 0.92, filter: "blur(6px)" }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={
                    shouldReduce
                      ? { opacity: 0 }
                      : { opacity: 0, x: 60, scale: 0.9, filter: "blur(3px)" }
                  }
                  transition={{
                    type: "spring",
                    bounce: 0.15,
                    duration: shouldReduce ? 0 : 0.4,
                  }}
                  custom={i}
                  variants={shouldReduce ? undefined : staggerChildren}
                  style={{
                    pointerEvents: "auto",
                    padding: "12px 12px 12px 18px",
                    borderRadius: "var(--radius-md)",
                    fontSize: 14,
                    fontWeight: 500,
                    maxWidth: 360,
                    boxShadow: "var(--shadow-lg)",
                    background: colors.bg,
                    color: "#fff",
                    // Glass effect for depth
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <span aria-hidden="true">{colors.icon}</span>
                    {t.message}
                  </span>
                  <motion.button
                    type="button"
                    onClick={() => remove(t.id)}
                    aria-label={`Dismiss ${t.type} notification`}
                    whileTap={{ scale: shouldReduce ? 1 : 0.9 }}
                    style={{
                      width: 44,
                      height: 44,
                      border: "none",
                      borderRadius: 8,
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                  >
                    <span aria-hidden="true">×</span>
                  </motion.button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
