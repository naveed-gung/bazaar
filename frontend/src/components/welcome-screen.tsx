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

const SPLASH_CSS = `
#bw{position:fixed;inset:0;z-index:90;display:flex;align-items:center;background:var(--foreground,#111111);color:var(--background,#f5f5f3);font-family:Archivo,'Instrument Sans',Arial,sans-serif;animation:bw-cover 1600ms linear both,bw-failsafe 1900ms linear both}
@media (prefers-reduced-motion:reduce){#bw,.bw-mark,.bw-rule,.bw-label{animation-duration:1ms!important;animation-delay:0ms!important}}
#bw.bw-exit{animation:bw-exit 300ms ease-out both}
.bw-shell{padding:0 clamp(24px,6vw,96px)}
.bw-mark{margin:0;border:1px solid var(--background,#f5f5f3);padding:12px 20px;font-size:clamp(44px,9vw,96px);line-height:1;font-weight:800;letter-spacing:-.02em;animation:bw-rise 480ms cubic-bezier(.22,1,.36,1) both}
.bw-mark span{color:var(--accent,#c42b1c)}
.bw-rule{display:block;width:min(512px,60vw);height:1px;margin-top:20px;background:var(--accent,#c42b1c);transform-origin:left center;animation:bw-sweep 900ms cubic-bezier(.22,1,.36,1) both}
.bw-label{margin:16px 0 0;font-size:11px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;opacity:.7;animation:bw-rise 480ms 120ms cubic-bezier(.22,1,.36,1) both}
@keyframes bw-cover{from{opacity:1}to{opacity:1}}
@keyframes bw-failsafe{0%,84%{opacity:1}100%{opacity:0;visibility:hidden}}
@keyframes bw-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes bw-sweep{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bw-exit{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-18px)}}
`;

const HOLD_MS = 1600;
const EXIT_MS = 300;
/** EXIT + slack — the unmount lands after the exit transition has finished. */
const TEARDOWN_MS = EXIT_MS + 100;

export function WelcomeScreen() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Flipped only from the post-hydration effect — the FIRST render (server and
  // client) always emits the identical static shell.
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const mounted = rootRef.current;
    if (!mounted) return;
    // Non-null alias captured AFTER the guard so the hoisted helpers below
    // see a definite HTMLDivElement.
    const root = mounted;

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

    function kill() {
      teardown();
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
      setGone(true);
    }
    function beginExit() {
      if (exited || tornDown) return;
      exited = true;
      window.clearTimeout(holdTimer);
      root.classList.add("bw-exit");
      exitTimer = window.setTimeout(teardown, TEARDOWN_MS);
    }
    function onAnimationEnd(event: AnimationEvent) {
      if (event.target !== root) return;
      if (event.animationName === "bw-cover") beginExit();
      else if (event.animationName === "bw-exit") teardown();
    }

    root.addEventListener("animationend", onAnimationEnd);
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
      root.removeEventListener("animationend", onAnimationEnd);
      off();
      document.documentElement.style.overflow = prevOverflow;
    };
  }, []);

  if (gone) return null;

  return (
    <div ref={rootRef} id="bw" aria-hidden="true">
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
