import { type ReactNode } from "react";
import { motion } from "motion/react";

interface AnimatedPageProps {
  children: ReactNode;
}

export default function AnimatedPage({ children }: AnimatedPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
      transition={{
        type: "spring",
        bounce: 0,
        duration: 0.5,
        layout: { type: "spring", bounce: 0, duration: 0.4 },
      }}
    >
      {children}
    </motion.div>
  );
}
