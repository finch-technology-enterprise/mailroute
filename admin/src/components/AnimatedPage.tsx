import { type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

interface AnimatedPageProps {
  children: ReactNode;
}

export default function AnimatedPage({ children }: AnimatedPageProps) {
  const shouldReduce = useReducedMotion();

  return (
    <motion.div
      initial={
        shouldReduce
          ? { opacity: 0 }
          : { opacity: 0, y: 10, filter: "blur(4px)" }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={
        shouldReduce
          ? { opacity: 0 }
          : { opacity: 0, y: -6, filter: "blur(2px)" }
      }
      transition={{
        type: "spring",
        bounce: 0,
        duration: shouldReduce ? 0 : 0.5,
        layout: { type: "spring", bounce: 0, duration: shouldReduce ? 0 : 0.4 },
      }}
    >
      {children}
    </motion.div>
  );
}
