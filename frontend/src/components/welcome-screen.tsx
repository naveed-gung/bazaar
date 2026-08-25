import { useEffect, useState } from "react";

/**
 * SWISS SIGNAL splash (SSR-12). Full-screen ink overlay shown once per browser
 * session: boxed wordmark, red rule sweep, letterspaced micro-label;
 * auto-dismisses after ~1.6s with a 300ms fade/slide-up exit. Escape, click,
 * or scroll ends it instantly.
 *
 * Hydration-safe by construction: SSR and the first client render emit null —
 * a mount effect consults sessionStorage + prefers-reduced-motion before
 * anything renders. Purely decorative (aria-hidden wrapper, no focus trap), so
 * the page beneath stays available to screen readers throughout.
 */

const WELCOME_KEY = "bazaar.welcomed.v1";
/** Time on screen before the automatic dismissal begins. */
const HOLD_MS = 1300;
/** Exit transition length — total splash ≈ 1.6s. */
const EXIT_MS = 300;
/** Reduced-motion visitors get a static flash instead of the sequence. */
const REDUCED_HOLD_MS = 200;

type Phase = "hidden" | "shown" | "leaving";

export function WelcomeScreen() {
  const [phase, setPhase] = useState<Phase>("hidden");
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let finished = false;
    const timers: number[] = [];
    let releaseScroll: (() => void) | null = null;

    let seen = false;
    let prefersReduced = false;
    try {
      seen = window.sessionStorage.getItem(WELCOME_KEY) !== null;
      prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* storage or media queries unavailable — fall through to showing */
    }
    setReduced(prefersReduced);
    if (seen) return;

    try {
      window.sessionStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* private mode — the splash simply repeats on the next reload */
    }

    // Body scroll is locked only while the splash is mounted.
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    releaseScroll = () => {
      document.documentElement.style.overflow = previousOverflow;
    };

    function finish() {
      if (finished) return;
      finished = true;
      if (prefersReduced) {
        releaseScroll?.();
        setPhase("hidden");
        return;
      }
      setPhase("leaving");
      timers.push(
        window.setTimeout(() => {
          releaseScroll?.();
          setPhase("hidden");
        }, EXIT_MS),
      );
    }

    setPhase("shown");
    timers.push(window.setTimeout(finish, prefersReduced ? REDUCED_HOLD_MS : HOLD_MS));

    // Escape, click, or scroll dismisses instantly.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }
    const dismiss = () => finish();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", dismiss);
    window.addEventListener("wheel", dismiss, { passive: true });
    window.addEventListener("touchmove", dismiss, { passive: true });

    return () => {
      for (const id of timers) window.clearTimeout(id);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("wheel", dismiss);
      window.removeEventListener("touchmove", dismiss);
      releaseScroll?.();
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <>
      {/* Scoped keyframes — styles.css belongs exclusively to the foundation
          agent, so the rise/sweep/exit animations travel with this component. */}
      <style>{`
        @keyframes welcome-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes welcome-sweep {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes welcome-exit {
          from { opacity: 1; transform: none; }
          to { opacity: 0; transform: translateY(-18px); }
        }
      `}</style>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[90] bg-foreground"
        style={
          phase === "leaving" ? { animation: `welcome-exit ${EXIT_MS}ms ease-out both` } : undefined
        }
      >
        <div className="shell flex min-h-dvh items-center">
          <div
            style={{
              animation: reduced ? undefined : "welcome-rise 480ms var(--ease-enter) both",
            }}
          >
            <p className="headline inline-block border border-background px-4 py-3 text-[clamp(2.75rem,9vw,6rem)] text-background sm:px-6">
              Bazaar<span className="text-accent">.</span>
            </p>
            <span
              className="mt-5 block h-px w-full max-w-lg origin-left bg-accent"
              style={{
                animation: reduced ? undefined : "welcome-sweep 900ms var(--ease-enter) both",
              }}
            />
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.24em] text-background/70">
              Everyday tech — est. MMXXVI
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
