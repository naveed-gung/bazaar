/**
 * Route-transition cover.
 *
 * SSR-65 — the full-document welcome splash that used to live here was DELETED
 * as dead code. History, so nobody re-adds it by accident: SSR-47 rev3 made the
 * splash client-only to kill a React #418 hydration mismatch, which meant its
 * first render returned null. `phase` started at "hidden", `if (phase ===
 * "hidden") return null` ran before the ref could ever attach, so `rootRef.current`
 * was always null and the timeline effect bailed on its own `if (!node) return`
 * guard on the first line. The splash could not set itself to "play" — it never
 * painted a single frame for anyone, in dev or in production. Removing it
 * changes nothing a visitor sees; it only deletes ~120 lines of unreachable
 * code, a scoped keyframe block and a document-level scroll lock that could
 * never fire.
 *
 * Re-introducing a load splash is a deliberate design decision, not a bug fix:
 * it would need a render path that actually mounts (SSR'd markup or a
 * `useState(() => ...)` initial phase), and the owner has already reported that
 * a full-length cover makes the site feel like it is hanging.
 *
 * What REMAINS below is live and does work: a short ink cover replayed on every
 * page-to-page navigation. It owns no ref and no scroll lock — visibility is
 * plain state driven by the router pathname — which is exactly why it survived
 * the same refactor that killed the splash.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";

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
