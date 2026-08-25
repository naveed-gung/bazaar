import { Children, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Motion primitives. SWISS SIGNAL removed parallax from the design language,
 * so `useParallax` is now a neutralised stub: the exported signature and
 * return shape are unchanged (callers keep compiling), the ref still attaches,
 * and `offset` is permanently 0 — no scroll listeners, no transforms.
 */

/** Fades children up into view once, when scrolled into the viewport. A quick
    token-driven fade-up only — opacity + transform, 240ms ease-out.

    SSR-18: the trigger geometry was relaxed after owner reports of cards on
    /shop and /deals staying invisible while scrolling DOWN into view. The old
    `threshold: 0.12` + `rootMargin: "0px 0px -8% 0px"` pair pushed the
    effective trigger line deep into a tall product card's entry (12% of a
    ~500px card must clear a line already 8% above the viewport bottom), so on
    short laptop/mobile viewports cards could pass through the whole lower
    half of the screen unrevealed. Now: threshold ≤0.1, a sane -5% bottom
    margin, fire-once semantics, and an immediate reveal when
    IntersectionObserver is unavailable. */
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
    if (typeof IntersectionObserver === "undefined") {
      // No observer support (very old browsers, exotic SSR hydration): never
      // leave content hidden.
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
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

/** SSR-15 — Swiss text-roll for `.index-row` labels. Wrap the label in an
    overflow-hidden mask sized to exactly one line (`h-[1.2em]`) containing TWO
    stacked spans — the ink copy, then a signal-red duplicate — and apply these
    classes to BOTH: on row hover/keyboard focus they translate up their own
    height together, so ink exits above while red arrives from below. Pure
    Tailwind utilities; the global prefers-reduced-motion block flattens the
    transition into an instant colour swap. */
export const INDEX_ROW_ROLL =
  "transition-transform duration-200 ease-out group-hover:-translate-y-full group-focus-visible:-translate-y-full";

/** Former scroll-linked parallax offset. Kept as a no-op so remaining imports
    stay valid; always returns a stable ref and a zero offset. */
export function useParallax(_strength = 0.18) {
  const ref = useRef<HTMLDivElement>(null);
  return { ref, offset: 0 };
}

/** Stable style payload handed to every useScrollDrift consumer — a transform
    hint only, so the identity never changes and nothing re-renders. */
const DRIFT_STYLE: CSSProperties = { willChange: "transform" };

/** SSR-39 — subtle scroll parallax ("drift") for above-the-fold rails. The
    element translates proportionally to its distance from the viewport centre
    (`strength`, default 0.08), clamped to ±24px, so rows glide gently up/down
    while the page scrolls — home-sections feel without any layout impact.

    Contract:
    - Hydration-safe: the server render and the FIRST client render emit NO
      transform; the offset is written imperatively to `node.style.transform`
      after mount only, so nothing can mismatch.
    - Zero layout shift: transform-only, never top/margin/height.
    - Disabled entirely under prefers-reduced-motion (checked once on mount).
    - rAF-throttled passive scroll/resize listeners; fully cleaned up on
      unmount, which also clears the inline transform.
    - Measurement subtracts the previously applied shift, so the element's own
      transform cannot feed back into the reading. */
export function useScrollDrift(strength = 0.14) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let applied = 0;
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      // Subtract the shift already on the element: getBoundingClientRect
      // reports the TRANSFORMED box, and reusing it would damp the drift.
      const distance = rect.top + rect.height / 2 - window.innerHeight / 2 - applied;
      const shift = Math.max(-40, Math.min(40, -distance * strength));
      applied = shift;
      node.style.transform = shift === 0 ? "" : `translateY(${shift.toFixed(2)}px)`;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      node.style.transform = "";
    };
  }, [strength]);

  return { ref, style: DRIFT_STYLE };
}

/** Wraps each direct child in its own Reveal with an incremental delay, so
    grids and lists enter with the system's 40 ms stagger. Additive API —
    existing Reveal consumers are unaffected. */
export function Stagger({
  children,
  step = 40,
  className = "",
}: {
  children: ReactNode;
  step?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) =>
        child === null || child === undefined ? (
          child
        ) : (
          <Reveal delay={index * step}>{child}</Reveal>
        ),
      )}
    </div>
  );
}
