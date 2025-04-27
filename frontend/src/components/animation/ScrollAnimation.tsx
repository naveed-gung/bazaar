import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, useAnimation, Variants } from "framer-motion";
import { AnimationDirection } from "./types";

interface ScrollAnimationProps {
  children: ReactNode;
  direction?: AnimationDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  threshold?: number;
  once?: boolean;
  className?: string;
  staggerChildren?: boolean;
  staggerDelay?: number;
  viewport?: boolean;
  // Special effects
  bounce?: boolean;
  springiness?: number;
}

export default function ScrollAnimation({
  children,
  direction = "up",
  delay = 0,
  duration = 0.5,
  distance = 50,
  threshold = 0.1,
  once = false,
  className = "",
  staggerChildren = false,
  staggerDelay = 0.1,
  viewport = true,
  bounce = false,
  springiness = 0.5,
}: ScrollAnimationProps) {
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef || !viewport) {
      controls.start("visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          controls.start("visible");
          if (once) {
            setHasAnimated(true);
            observer.unobserve(currentRef);
          }
        } else {
          controls.start("hidden");
        }
      },
      {
        threshold,
        rootMargin: "10px",
      }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [controls, once, threshold, viewport, hasAnimated]);

  // Define animation variants based on direction
  const getDirectionalVariants = (): Variants => {
    const getInitial = () => {
      switch (direction) {
        case "up":
          return { y: distance, opacity: 0 };
        case "down":
          return { y: -distance, opacity: 0 };
        case "left":
          return { x: distance, opacity: 0 };
        case "right":
          return { x: -distance, opacity: 0 };
        case "scale":
          return { scale: 0.8, opacity: 0 };
        case "rotate":
          return { rotate: -10, opacity: 0 };
        case "opacity":
          return { opacity: 0 };
        case "translateUp":
          return { y: distance, opacity: 0 };
        case "translateDown":
          return { y: -distance, opacity: 0 };
        case "translateLeft":
          return { x: distance, opacity: 0 };
        case "translateRight":
          return { x: -distance, opacity: 0 };
        default:
          return { y: distance, opacity: 0 };
      }
    };

    return {
      hidden: getInitial(),
      visible: {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotate: 0,
        transition: {
          duration,
          delay,
          ease: bounce ? "backOut" : "easeOut",
          stiffness: bounce ? 600 : 100,
          damping: bounce ? 10 : 20,
          mass: springiness,
          when: staggerChildren ? "beforeChildren" : "afterChildren",
          staggerChildren: staggerChildren ? staggerDelay : 0,
        },
      },
    };
  };

  const childVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
      },
    },
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={getDirectionalVariants()}
      className={className}
      whileInView={!viewport ? "visible" : undefined}
    >
      {staggerChildren ? (
        <motion.div variants={childVariants}>
          {children}
        </motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
} 