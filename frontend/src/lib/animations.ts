import { Variants } from "framer-motion";

// Fade in with upward motion
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6 }
  },
};

// Scale on hover/tap
export const scaleInHover: Variants = {
  initial: { scale: 1 },
  hover: { scale: 1.05, transition: { duration: 0.2 } },
  tap: { scale: 0.95, transition: { duration: 0.1 } },
};

// Glow effect on hover
export const glowHover: Variants = {
  initial: {},
  hover: {
    boxShadow: "0 0 15px rgba(var(--primary-rgb), 0.5)",
    transition: {
      duration: 0.3
    }
  }
};

// Container with stagger children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Pulse animation
export const pulseAnimation: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "reverse",
    },
  },
};
