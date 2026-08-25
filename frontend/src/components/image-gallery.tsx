import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  src: string;
  srcSet?: string;
  alt: string;
};

/**
 * Product gallery. Thumbs are real buttons (Tab-reachable, visible focus);
 * ArrowLeft/ArrowRight anywhere in the gallery move the selection. The main
 * stage toggles a transform-only zoom. When `activeIndex` is provided the
 * selection follows the caller (variant-driven hero shots); otherwise the
 * gallery owns its state. Swiss: sharp stage, square thumbs, active thumb
 * carries a 2px ink ring.
 */
export function ImageGallery({
  images,
  name,
  className,
  activeIndex,
}: {
  images: GalleryImage[];
  name: string;
  className?: string;
  /** Optional controlled selection (e.g. driven by the VariantPicker). */
  activeIndex?: number | undefined;
}) {
  const [internal, setInternal] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const active = activeIndex ?? internal;
  const controlled = activeIndex !== undefined;

  useEffect(() => {
    setZoomed(false);
  }, [active]);

  if (images.length === 0) return null;
  const current = images[Math.min(active, images.length - 1)];
  if (!current) return null;

  function select(index: number) {
    if (!controlled) setInternal(index);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = (Math.min(active, images.length - 1) + 1) % images.length;
      select(next);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const previous = (Math.min(active, images.length - 1) - 1 + images.length) % images.length;
      select(previous);
    }
  }

  return (
    <div className={cn("flex flex-col gap-4", className)} onKeyDown={onKeyDown}>
      <figure className="relative aspect-square w-full overflow-hidden border border-border bg-surface-2">
        <button
          type="button"
          onClick={() => setZoomed((value) => !value)}
          aria-pressed={zoomed}
          aria-label={zoomed ? `Exit zoom on ${name}` : `Zoom ${name}`}
          className="block h-full w-full cursor-zoom-in overflow-hidden"
        >
          <img
            src={current.src}
            srcSet={current.srcSet || undefined}
            sizes={current.srcSet ? "(min-width: 1024px) 45vw, 92vw" : undefined}
            alt={current.alt || name}
            className={cn(
              "h-full w-full object-cover transition-transform duration-700 [transition-timing-function:var(--ease-enter)]",
              zoomed && "scale-[1.6] cursor-zoom-out",
            )}
            loading="eager"
            decoding="async"
          />
        </button>
      </figure>
      {images.length > 1 && (
        <div
          role="group"
          aria-label={`${name} image thumbnails`}
          className="flex gap-3 overflow-x-auto pb-1"
        >
          {images.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => select(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-current={index === Math.min(active, images.length - 1)}
              className={cn(
                "h-16 w-16 shrink-0 cursor-pointer overflow-hidden border transition-all",
                index === Math.min(active, images.length - 1)
                  ? "border-border ring-2 ring-foreground"
                  : "border-border opacity-70 hover:opacity-100",
              )}
            >
              <img
                src={image.src}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
