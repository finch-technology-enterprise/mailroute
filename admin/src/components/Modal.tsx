import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  maxWidth?: number;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  closeOnBackdrop?: boolean;
  overlayStyle?: CSSProperties;
  surfaceClassName?: string;
  surfaceStyle?: CSSProperties;
}

interface ModalEntry {
  id: symbol;
  restoreFocus: () => HTMLElement | null;
  layer: HTMLDivElement | null;
  closing: boolean;
}

const modalStack: ModalEntry[] = [];
let rootWasInert = false;
let bodyOverflow = "";
let bodyPaddingRight = "";

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe:not([tabindex='-1'])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function isTopmost(id: symbol) {
  return modalStack.at(-1)?.id === id;
}

function updateModalLayers() {
  modalStack.forEach((entry, index) => {
    const isTop = index === modalStack.length - 1;
    if (!entry.layer) return;
    entry.layer.inert = !isTop;
    if (isTop) entry.layer.removeAttribute("aria-hidden");
    else entry.layer.setAttribute("aria-hidden", "true");
  });
}

function lockBackground() {
  if (modalStack.length !== 1) return;

  const root = document.getElementById("root");
  if (root) {
    rootWasInert = root.inert;
    root.inert = true;
  }

  bodyOverflow = document.body.style.overflow;
  bodyPaddingRight = document.body.style.paddingRight;
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0)
    document.body.style.paddingRight = `${scrollbarWidth}px`;
}

function unlockBackground() {
  if (modalStack.length > 0) return;

  const root = document.getElementById("root");
  if (root) root.inert = rootWasInert;
  document.body.style.overflow = bodyOverflow;
  document.body.style.paddingRight = bodyPaddingRight;
}

export default function Modal({
  open,
  onClose,
  children,
  title,
  maxWidth = 520,
  role = "dialog",
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
  returnFocusRef,
  closeOnBackdrop = true,
  overlayStyle,
  surfaceClassName = "modal-surface",
  surfaceStyle,
}: ModalProps) {
  const shouldReduce = useReducedMotion();
  const generatedTitleId = useId();
  const activeModalId = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);
  const initialFocusRefRef = useRef(initialFocusRef);
  const returnFocusRefRef = useRef(returnFocusRef);
  const shouldReduceRef = useRef(shouldReduce);
  const overlayRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const labelledBy = ariaLabelledBy ?? (title ? generatedTitleId : undefined);
  onCloseRef.current = onClose;
  initialFocusRefRef.current = initialFocusRef;
  returnFocusRefRef.current = returnFocusRef;
  shouldReduceRef.current = shouldReduce;

  useEffect(() => {
    if (!open) return;

    const previousEntry = modalStack.at(-1);
    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const entry: ModalEntry = {
      id: Symbol("modal"),
      restoreFocus: previousEntry?.closing
        ? previousEntry.restoreFocus
        : returnFocusRefRef.current
          ? () => returnFocusRefRef.current?.current ?? null
          : () => activeElement,
      layer: overlayRef.current,
      closing: false,
    };
    activeModalId.current = entry.id;
    modalStack.push(entry);
    updateModalLayers();
    lockBackground();

    const focusModal = () => {
      if (!isTopmost(entry.id)) return;
      const target =
        initialFocusRefRef.current?.current ??
        surfaceRef.current?.querySelector<HTMLElement>("[autofocus]") ??
        surfaceRef.current?.querySelector<HTMLElement>(focusableSelector) ??
        surfaceRef.current;
      target?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusModal);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost(entry.id)) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !surfaceRef.current) return;
      const focusable = [
        ...surfaceRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ].filter(
        (element) =>
          !element.hidden &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        surfaceRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!surfaceRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      entry.closing = true;
      const finishClose = () => {
        const index = modalStack.findIndex((item) => item.id === entry.id);
        const wasTopmost = index === modalStack.length - 1;
        if (index >= 0) modalStack.splice(index, 1);
        const layerStillActive = modalStack.some(
          (item) => item.layer === entry.layer,
        );
        if (entry.layer && !layerStillActive) {
          entry.layer.inert = true;
          entry.layer.setAttribute("aria-hidden", "true");
        }
        updateModalLayers();
        unlockBackground();

        if (wasTopmost) {
          requestAnimationFrame(() => {
            const restoreTarget = entry.restoreFocus();
            if (restoreTarget?.isConnected) {
              restoreTarget.focus({ preventScroll: true });
              return;
            }

            const fallbackRoot =
              modalStack.at(-1)?.layer ?? document.getElementById("root");
            const fallback = fallbackRoot
              ? [
                  ...fallbackRoot.querySelectorAll<HTMLElement>(
                    focusableSelector,
                  ),
                ].find(
                  (element) =>
                    !element.hidden &&
                    element.getAttribute("aria-hidden") !== "true" &&
                    element.getClientRects().length > 0,
                )
              : undefined;
            fallback?.focus({ preventScroll: true });
          });
        }
      };

      if (shouldReduceRef.current) finishClose();
      else window.setTimeout(finishClose, 400);
    };
  }, [open]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (
      closeOnBackdrop &&
      event.target === event.currentTarget &&
      isTopmost(activeModalId.current)
    ) {
      onClose();
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduce ? 0 : 0.18 }}
          onClick={handleBackdropClick}
          style={overlayStyle}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.08)",
              pointerEvents: "none",
            }}
          />
          <motion.div
            ref={surfaceRef}
            className={surfaceClassName}
            style={{ maxWidth, ...surfaceStyle }}
            initial={
              shouldReduce
                ? { opacity: 0 }
                : { opacity: 0, y: 24, scale: 0.97, filter: "blur(4px)" }
            }
            animate={
              shouldReduce
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }
            }
            exit={
              shouldReduce
                ? { opacity: 0 }
                : { opacity: 0, y: 16, scale: 0.97, filter: "blur(2px)" }
            }
            transition={
              shouldReduce
                ? { duration: 0 }
                : {
                    type: "spring",
                    bounce: 0.18,
                    duration: 0.38,
                    layout: { type: "spring", bounce: 0, duration: 0.35 },
                  }
            }
            layout={!shouldReduce}
            role={role}
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={labelledBy}
            aria-describedby={ariaDescribedBy}
            tabIndex={-1}
          >
            {title && (
              <h2 id={generatedTitleId} className="mb-6">
                {title}
              </h2>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
