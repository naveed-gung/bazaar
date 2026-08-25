import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Heart, LoaderCircle, Scale } from "lucide-react";
import { formatPriceRange, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { AvailabilityTag, Stars } from "@/components/ui";

const CARD_SIZES = "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw";

/**
 * The one product card (SF-12) — consumed by nine routes. Swiss print card:
 * sharp media on white, SKU-style brand·category meta line, oversized tabular
 * price, red square sale tag. Price range across variants, option swatches,
 * quick-add into the mini-cart drawer, and a responsive srcset image. One link
 * target: the media and the title link out, while the heart, compare and
 * quick-add stay siblings, never nested inside a link.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: Product;
  priority?: boolean;
}) {
  const { addToCart, openCart, toggleWishlist, isWishlisted, toggleCompare, isCompared } =
    useStore();
  // SSR-25 — quick-add AWAITS the cart write before opening the drawer, so the
  // mini-cart can never render "Your cart (0) / empty" over a stale cache.
  const [adding, setAdding] = useState(false);
  async function quickAdd() {
    if (adding || soldOut) return;
    setAdding(true);
    try {
      const added = await addToCart(product.slug);
      if (added) openCart();
    } finally {
      setAdding(false);
    }
  }
  const wished = isWishlisted(product.slug);
  const compared = isCompared(product.slug);
  const hasRange =
    product.priceMin !== undefined &&
    product.priceMax !== undefined &&
    product.priceMax > product.priceMin;
  const saved = product.was ? Math.round((1 - product.price / product.was) * 100) : 0;
  const gallery = product.images?.[0];
  const soldOut = product.availability === "out_of_stock";
  const swatches = (product.swatches ?? []).slice(0, 4);
  const extraSwatches = (product.swatches?.length ?? 0) - swatches.length;

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden border-b border-border bg-surface">
        {product.badge && (
          <span
            className={`pill absolute left-0 top-0 z-10 border-0 ${
              product.badge === "Deal"
                ? "bg-accent text-accent-foreground"
                : "bg-signal text-signal-foreground"
            }`}
          >
            {product.badge === "Deal" && saved > 0 ? `−${saved}%` : product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.slug)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
          className="absolute right-3 top-3 z-10 grid h-11 w-11 cursor-pointer place-items-center border border-border bg-surface transition-colors hover:border-foreground"
        >
          <Heart
            className={wished ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4 text-muted-foreground"}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => toggleCompare(product.slug)}
          aria-pressed={compared}
          aria-label={
            compared ? `Remove ${product.name} from comparison` : `Compare ${product.name}`
          }
          className="absolute right-3 top-16 z-10 grid h-11 w-11 cursor-pointer place-items-center border border-border bg-surface transition-colors hover:border-foreground"
        >
          <Scale
            className={compared ? "h-4 w-4 text-accent" : "h-4 w-4 text-muted-foreground"}
            aria-hidden="true"
          />
        </button>
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block overflow-hidden">
          <img
            src={gallery?.url ?? product.img}
            srcSet={
              gallery?.sources.map((source) => `${source.url} ${source.width}w`).join(", ") ||
              undefined
            }
            sizes={gallery?.sources.length ? CARD_SIZES : undefined}
            alt={product.name}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            width={800}
            height={1000}
            className="aspect-square h-full w-full object-cover"
          />
        </Link>
        {/* z-10 pins the bar above the media link; pointer-events-none keeps the
            hidden (opacity-0) state click-transparent, so a desktop click on
            the lower media reaches the link until the bar is actually shown. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 opacity-100 transition-opacity [transition-timing-function:var(--ease-enter)] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => void quickAdd()}
            disabled={soldOut || adding}
            className="btn btn-primary pointer-events-auto w-full"
          >
            {adding && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {soldOut ? "Out of stock" : adding ? "Adding…" : "Quick add"}
            {!soldOut && !adding && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* SKU-style meta line — brand · category in micro uppercase. */}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {product.brand} · {product.category}
      </p>
      <h3 className="mt-2 text-sm font-semibold uppercase leading-snug tracking-[0.04em]">
        <Link
          to="/product/$slug"
          params={{ slug: product.slug }}
          className="decoration-2 underline-offset-4 hover:text-accent hover:underline"
        >
          {product.name}
        </Link>
      </h3>
      {swatches.length > 0 && (
        <span
          className="mt-2.5 flex items-center gap-1.5"
          role="img"
          aria-label={`${product.swatchName ?? "Option"}: ${product.swatches?.join(", ")}`}
        >
          {swatches.map((value) => (
            <span
              key={value}
              className="h-3.5 w-3.5 border border-border bg-surface-2"
              title={value}
            />
          ))}
          {extraSwatches > 0 && (
            <span className="tabular text-[11px] font-semibold text-muted-foreground">
              +{extraSwatches}
            </span>
          )}
        </span>
      )}
      <div className="mt-2.5 flex items-baseline gap-2.5">
        <span
          className={`price tabular text-xl lg:text-2xl ${
            product.was ? "text-deal" : "text-foreground"
          }`}
        >
          {hasRange
            ? formatPriceRange(product.priceMin ?? product.price, product.priceMax ?? product.price)
            : formatPriceRange(product.price, product.price)}
        </span>
        {product.was && (
          <span className="price tabular text-sm text-muted-foreground line-through">
            ${product.was.toFixed(2)}
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Stars rating={product.rating} />
        <span className="tabular text-xs font-medium">{product.rating.toFixed(1)}</span>
        <span className="tabular text-xs text-muted-foreground">({product.reviews})</span>
      </div>
      <AvailabilityTag availability={product.availability} className="mt-2.5" />
    </article>
  );
}
