import { useEffect, useRef, useState } from "react";
import { ArrowDown, Play } from "lucide-react";
import type { Product } from "@/lib/products";

type Scrubber = () => void;
const scrubbers = new Set<Scrubber>();
let scrubFrame = 0;

function publishScroll() {
  if (scrubFrame) return;
  scrubFrame = window.requestAnimationFrame(() => {
    scrubFrame = 0;
    scrubbers.forEach((scrub) => scrub());
  });
}

function subscribe(scrub: Scrubber) {
  scrubbers.add(scrub);
  if (scrubbers.size === 1) {
    window.addEventListener("scroll", publishScroll, { passive: true });
    window.addEventListener("resize", publishScroll);
  }
  scrub();
  return () => {
    scrubbers.delete(scrub);
    if (!scrubbers.size) {
      window.removeEventListener("scroll", publishScroll);
      window.removeEventListener("resize", publishScroll);
      if (scrubFrame) window.cancelAnimationFrame(scrubFrame);
      scrubFrame = 0;
    }
  };
}

type VisualProps = {
  product: Product;
  sceneRef: React.RefObject<HTMLElement | null>;
  progressRef: React.RefObject<HTMLSpanElement | null>;
  cinematic?: boolean;
};

function ScrubVisual({ product, sceneRef, progressRef, cinematic = false }: VisualProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    const scene = sceneRef.current;
    const video = videoRef.current;
    if (!scene || !video || !product.motionUrl) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (reduced || connection?.saveData || connection?.effectiveType === "2g") return;

    let disposed = false;
    let loading = false;
    let objectUrl = "";
    let unsubscribe = () => {};
    let duration = 0;
    let pendingTime = 0;
    let paintedOnce = false;

    const progressForScene = () => {
      const rect = scene.getBoundingClientRect();
      const viewport = window.innerHeight;
      const raw = cinematic
        ? -rect.top / Math.max(1, rect.height - viewport)
        : (viewport - rect.top) / Math.max(1, viewport + rect.height);
      return Math.min(1, Math.max(0, raw));
    };

    const seek = () => {
      const progress = progressForScene();
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      if (!duration) return;
      pendingTime = Math.min(Math.max(0, duration - 0.035), progress * duration);
      if (video.seeking || Math.abs(video.currentTime - pendingTime) < 0.016) return;
      video.currentTime = pendingTime;
    };

    const onSeeked = () => {
      if (!paintedOnce) {
        paintedOnce = true;
        setPainted(true);
      }
      if (Math.abs(video.currentTime - pendingTime) >= 0.016) video.currentTime = pendingTime;
    };

    const onMetadata = () => {
      duration = Number.isFinite(video.duration) ? video.duration : 0;
      unsubscribe = subscribe(seek);
      seek();
    };

    const prime = () => {
      if (!video.src) return;
      void video
        .play()
        .then(() => video.pause())
        .catch(() => undefined);
    };

    const load = async () => {
      if (loading || objectUrl) return;
      loading = true;
      try {
        const response = await fetch(product.motionUrl!, { credentials: "same-origin" });
        if (!response.ok) return;
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        video.src = objectUrl;
        video.load();
        window.addEventListener("touchstart", prime, { once: true, passive: true });
      } catch {
        // The product image remains the complete fallback.
      }
    };

    video.addEventListener("loadedmetadata", onMetadata);
    video.addEventListener("seeked", onSeeked);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load();
      },
      { rootMargin: cinematic ? "700px 0px" : "320px 0px" },
    );
    observer.observe(scene);

    return () => {
      disposed = true;
      observer.disconnect();
      unsubscribe();
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("seeked", onSeeked);
      window.removeEventListener("touchstart", prime);
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cinematic, product.motionUrl, progressRef, sceneRef]);

  return (
    <div className="product-motion-visual">
      <img
        src={product.img}
        alt={product.name}
        loading={cinematic ? "eager" : "lazy"}
        width={700}
        height={700}
        className="product-motion-image"
      />
      <video
        ref={videoRef}
        aria-hidden="true"
        muted
        playsInline
        preload="none"
        poster={product.img}
        tabIndex={-1}
        data-painted={painted ? "true" : "false"}
        className="product-motion-video"
      />
    </div>
  );
}

export function ProductScrollMedia({ product }: { product: Product }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  return (
    <div ref={sceneRef} className="product-card-motion">
      <ScrubVisual product={product} sceneRef={sceneRef} progressRef={progressRef} />
      <span className="product-card-motion-rail" aria-hidden="true">
        <span ref={progressRef} />
      </span>
    </div>
  );
}

export function ProductCinematic({ product }: { product: Product }) {
  const sceneRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  return (
    <section
      ref={sceneRef}
      className="product-cinematic"
      aria-label={`${product.name} scroll inspection`}
    >
      <div className="product-cinematic-sticky">
        <div className="product-cinematic-frame">
          <ScrubVisual product={product} sceneRef={sceneRef} progressRef={progressRef} cinematic />
        </div>
        <div className="product-cinematic-copy">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-glow">
            <Play className="h-3.5 w-3.5" fill="currentColor" /> Scroll inspection
          </p>
          <h2 className="mt-4 max-w-xl text-3xl font-extrabold tracking-tight sm:text-5xl">
            See {product.name} in motion.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
            Your scroll controls every frame. No autoplay, sound, tracker, or external video
            service.
          </p>
          <div className="mt-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <ArrowDown className="h-4 w-4" /> Keep scrolling
          </div>
        </div>
        <span className="product-cinematic-rail" aria-hidden="true">
          <span ref={progressRef} />
        </span>
      </div>
    </section>
  );
}
