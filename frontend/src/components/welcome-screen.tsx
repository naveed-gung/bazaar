/**
 * SWISS SIGNAL splash — STATIC SSR'D COMPONENT (SSR-32).
 *
 * HISTORY: SSR-12/18/23 kept the overlay in React and flickered; SSR-27/30
 * moved it into imperative pre-paint DOM injection — and that FAILED the whole
 * document: the body-start script executes while the HTML parser is still
 * INSIDE <body>, so at execution time body's only child is the script itself
 * and "append to end of body" placed `#bw-host` BETWEEN the script and the app
 * root `<div class="flex min-h-dvh flex-col">`. TanStack Start hydrates the
 * whole document (hydrateRoot(document)), and react-dom's canHydrateInstance
 * aborts on any unexpected element among hydrated siblings — so hydration
 * failed on every cold load and React regenerated the entire tree client-side.
 *
 * THE STATIC CONTRACT (binding, SSR-32 — supersedes SSR-27 rev2 and SSR-30):
 *
 * 1. This component RETURNS the overlay JSX UNCONDITIONALLY. The markup ships
 *    in the SSR payload and hydrates identically by construction — no state in
 *    the first render, no dataset reads, no storage reads — so nothing can
 *    mismatch and nothing can flash. CSS paints the ink cover from the first
 *    frame (restoring the SSR-18 "covers every fresh full-document load"
 *    directive); there is NO session gate.
 * 2. Teardown happens ONLY post-hydration: one useEffect owns the timeline
 *    (beginExit at 1600 ms, unmount ≈1900-2000 ms), one-shot capture-phase
 *    click/keydown and passive scroll/wheel/touchmove skip listeners, and the
 *    html scroll-lock/unlock. A `gone` state flips the component to null AFTER
 *    mount — removing nodes after hydration can never cause a mismatch.
 * 3. Zero JS-driven visuals: pure CSS keyframes only — `bw-cover` holds
 *    1600 ms, `bw-rise`/`bw-sweep` decorate, `bw-exit` fades/slides 300 ms,
 *    and `bw-failsafe` force-hides at ~1900 ms so a visitor whose JS dies (or
 *    is disabled) is never trapped behind the cover. Colors carry literal
 *    fallbacks so a not-yet-loaded stylesheet still paints ink/paper/red.
 * 4. Reduced motion collapses every duration to ~1 ms via the scoped media
 *    query AND tears down within ~60 ms from the effect.
 *
 * SPA navigation never remounts the root, so the splash cannot replay
 * mid-session. The keyframes are scoped here because styles.css remains
 * foundation-exclusive.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";

const SPLASH_CSS = `
#bw{position:fixed;inset:0;z-index:90;display:flex;align-items:center;background:var(--foreground,#111111);color:var(--background,#f5f5f3);font-family:Archivo,'Instrument Sans',Arial,sans-serif;animation:bw-cover 900ms linear both,bw-failsafe 1150ms linear both}
@media (prefers-reduced-motion:reduce){#bw,.bw-mark,.bw-rule,.bw-label{animation-duration:1ms!important;animation-delay:0ms!important}}
#bw.bw-exit{animation:bw-exit 300ms ease-out both}
.bw-shell{padding:0 clamp(24px,6vw,96px)}
.bw-mark{margin:0;border:1px solid var(--background,#f5f5f3);padding:12px 20px;font-size:clamp(44px,9vw,96px);line-height:1;font-weight:800;letter-spacing:-.02em;animation:bw-rise 480ms cubic-bezier(.22,1,.36,1) both}
.bw-mark span{color:var(--accent,#c42b1c)}
.bw-rule{display:block;width:min(512px,60vw);height:1px;margin-top:20px;background:var(--accent,#c42b1c);transform-origin:left center;animation:bw-sweep 900ms cubic-bezier(.22,1,.36,1) both}
.bw-label{margin:16px 0 0;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;opacity:.7;animation:bw-rise 480ms 120ms cubic-bezier(.22,1,.36,1) both}
@keyframes bw-cover{from{opacity:1}to{opacity:1}}
@keyframes bw-failsafe{0%,78%{opacity:1}100%{opacity:0;visibility:hidden}}
@keyframes bw-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes bw-sweep{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bw-exit{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-18px)}}
`;

/* SSR-47 rev2 — the owner reported the full-length splash made both local dev
   and production feel like the site hangs. Time-to-content is halved: 900 ms
   hold + 250 ms exit keeps the brand moment while more than halving the
   interaction delay. */
const HOLD_MS = 900;
const EXIT_MS = 250;
/** EXIT + slack — the unmount lands after the exit transition has finished. */
const TEARDOWN_MS = EXIT_MS + 100;

export function WelcomeScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  /* SSR-47 rev3 — PRODUCTION HOTFIX (React #418 on bazaa1.netlify.app): the
     static-SSR shell was the last remaining hydration surface. The splash now
     mounts CLIENT-ONLY: the first render (server AND client) emits nothing,
     a post-hydration effect flips the phase to "play", and teardown flips it
     back to "hidden". Zero SSR markup = zero possibility of a hydration
     mismatch from the splash. Cost: the cover appears one tick after first
     paint instead of with it — accepted to guarantee an interactive page. */
  const [phase, setPhase] = useState<"hidden" | "play" | "exit">("hidden");

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const root = node;

    let exited = false;
    let tornDown = false;
    let holdTimer = 0;
    let exitTimer = 0;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* matchMedia unavailable — fall through to the normal timeline */
    }

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    // SSR-45 — skip gestures exit GRACEFULLY through the fade instead of
    // vanishing in place. Reduced-motion collapses durations to ~1 ms.
    function kill() {
      beginExit();
    }
    function off() {
      document.removeEventListener("click", kill, true);
      document.removeEventListener("keydown", kill, true);
      window.removeEventListener("scroll", kill, true);
      window.removeEventListener("wheel", kill, true);
      window.removeEventListener("touchmove", kill, true);
    }
    function teardown() {
      if (tornDown) return;
      tornDown = true;
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
      off();
      document.documentElement.style.overflow = prevOverflow;
      setPhase("hidden");
    }
    function beginExit() {
      if (exited || tornDown) return;
      exited = true;
      window.clearTimeout(holdTimer);
      setPhase("exit");
      exitTimer = window.setTimeout(teardown, TEARDOWN_MS);
    }

    setPhase("play");
    holdTimer = window.setTimeout(beginExit, HOLD_MS);
    if (reduced) holdTimer = window.setTimeout(teardown, 60);

    // One-shot skip affordances — any intent from the visitor dismisses now.
    document.addEventListener("click", kill, { capture: true, once: true });
    document.addEventListener("keydown", kill, { capture: true, once: true });
    window.addEventListener("scroll", kill, { passive: true, once: true });
    window.addEventListener("wheel", kill, { passive: true, once: true });
    window.addEventListener("touchmove", kill, { passive: true, once: true });

    return () => {
      // StrictMode/unmount safety: restore scroll and listeners even when the
      // timers never fired. Idempotent with teardown().
      window.clearTimeout(holdTimer);
      window.clearTimeout(exitTimer);
      off();
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      ref={rootRef}
      id="bw"
      aria-hidden="true"
      className={phase === "exit" ? "bw-exit" : undefined}
    >
      <style dangerouslySetInnerHTML={{ __html: SPLASH_CSS }} />
      <div className="bw-shell">
        <p className="bw-mark">
          Bazaar<span>.</span>
        </p>
        <span className="bw-rule" />
        <p className="bw-label">Everyday tech — est. MMXXVI</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   SSR-47 — ROUTE-TRANSITION COVER. Owner directive: the welcome moment plays
   when a user goes from page to page as well as on full loads. This companion
   component watches the router pathname and replays a SHORT cover (fade-in
   140 ms, hold ~380 ms, fade-out 220 ms — pure CSS timeline, JS only flips
   visibility) on every pathname change AFTER the first render. The very first
   render is skipped because the full-length <WelcomeScreen /> above already
   owns the initial document load. Client-side remounts/toggles happen strictly
   post-hydration, so there is no SSR divergence surface at all. Reduced-motion
   visitors never see it. */

const COVER_CSS = `
#bwt{position:fixed;inset:0;z-index:89;display:flex;align-items:center;background:var(--foreground,#111111);color:var(--background,#f5f5f3);font-family:Archivo,'Instrument Sans',Arial,sans-serif;animation:bwt-in 100ms ease-out both,bwt-out 160ms ease-in 260ms both}
#bwt .bw-shell{padding:0 clamp(24px,6vw,96px)}
#bwt .bw-mark{margin:0;border:1px solid var(--background,#f5f5f3);padding:8px 16px;font-size:clamp(28px,5vw,48px);line-height:1;font-weight:800;letter-spacing:-.02em}
#bwt .bw-mark span{color:var(--accent,#c42b1c)}
#bwt .bw-rule{display:block;width:min(360px,50vw);height:2px;margin-top:14px;background:var(--accent,#c42b1c);transform-origin:left center;animation:bwt-sweep 420ms cubic-bezier(.22,1,.36,1) 60ms both}
@keyframes bwt-in{from{opacity:0}to{opacity:1}}
@keyframes bwt-out{from{opacity:1}to{opacity:0;visibility:hidden}}
@keyframes bwt-sweep{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (prefers-reduced-motion:reduce){#bwt{display:none}}
`;

export function RouteTransitionCover() {
  const pathname = useLocation().pathname;
  // The first pathname value belongs to the initial document load, which
  // <WelcomeScreen /> already covers — so the very first effect run is a no-op.
  const seenInitial = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!seenInitial.current) {
      seenInitial.current = true;
      return;
    }
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* matchMedia unavailable — default to showing the cover */
    }
    if (reduced) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 440);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div id="bwt" aria-hidden="true">
      <style dangerouslySetInnerHTML={{ __html: COVER_CSS }} />
      <div className="bw-shell">
        <p className="bw-mark">
          Bazaar<span>.</span>
        </p>
        <span className="bw-rule" />
      </div>
    </div>
  );
}
