import { useEffect, useRef, useState, type ReactNode } from "react";

/** Fades and lifts children into view once, when scrolled into the viewport. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`${shown ? "reveal reveal-in" : "reveal"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Returns a scroll-linked offset in px for parallax layers. */
export function useParallax(strength = 0.18) {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const progress = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      setOffset(progress * strength * 100);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [strength]);

  return { ref, offset };
}
