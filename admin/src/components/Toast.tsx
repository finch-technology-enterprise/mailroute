import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "motion/react";

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
    transition: { delay: i * 0.05, type: "spring" as const, bounce: 0, duration: 0.35 },
  }),
};

const toastColors = {
  success: { bg: "#34c759", icon: "✓" },
  error: { bg: "#ff3b30", icon: "✕" },
  info: { bg: "#0071e3", icon: "ℹ" },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type }]);
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
                layout
                initial={{ opacity: 0, y: -16, scale: 0.92, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: 60, scale: 0.9, filter: "blur(3px)" }}
                transition={{
                  type: "spring",
                  bounce: 0.15,
                  duration: 0.4,
                }}
                custom={i}
                variants={staggerChildren}
                onClick={() => remove(t.id)}
                style={{
                  pointerEvents: "auto",
                  cursor: "pointer",
                  padding: "12px 18px",
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
                }}
                whileTap={{ scale: 0.96 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {colors.icon} {t.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
