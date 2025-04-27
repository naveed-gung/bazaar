import { useEffect, useRef } from 'react';
import { useAnimation } from 'framer-motion';
import { AnimationDirection } from '@/components/animation/types';

interface ScrollAnimationOptions {
  threshold?: number;
  once?: boolean;
  delay?: number;
  rootMargin?: string;
  animateOut?: boolean;
  type?: AnimationDirection;
}

export function useScrollAnimation({
  threshold = 0.1,
  once = true,
  delay = 0,
  rootMargin = "10px",
  type = "up",
  animateOut = false
}: ScrollAnimationOptions = {}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          currentRef.style.opacity = "1";
          currentRef.style.transform = "translate(0, 0)";
          if (once) {
            observer.unobserve(currentRef);
          }
        } else if (animateOut) {
          currentRef.style.opacity = "0";
          switch (type) {
            case "up":
              currentRef.style.transform = "translateY(20px)";
              break;
            case "down":
              currentRef.style.transform = "translateY(-20px)";
              break;
            case "left":
              currentRef.style.transform = "translateX(-20px)";
              break;
            case "right":
              currentRef.style.transform = "translateX(20px)";
              break;
            case "scale":
              currentRef.style.transform = "scale(0.95)";
              break;
            default:
              currentRef.style.transform = "translateY(20px)";
          }
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold, once, type, animateOut, rootMargin]);

  return ref;
}