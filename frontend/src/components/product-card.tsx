import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { formatPrice, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { ProductScrollMedia } from "@/components/product-scroll-media";
import { AvailabilityTag, Stars } from "@/components/ui";

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const wished = isWishlisted(product.slug);
  const saved = product.was ? Math.round((1 - product.price / product.was) * 100) : 0;

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface transition-colors group-hover:border-signal/40">
        {product.badge && (
          <span
            className={`absolute left-4 top-4 z-10 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${
              product.badge === "New"
                ? "bg-signal text-signal-foreground"
                : "bg-deal text-signal-foreground"
            }`}
          >
            {product.badge === "Deal" && saved > 0 ? `-${saved}%` : product.badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.slug)}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name}`}
          className="absolute right-4 top-4 z-10 grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-border bg-background/70 backdrop-blur transition-colors hover:border-signal"
        >
          <Heart
            className={wished ? "h-4 w-4 fill-signal text-signal" : "h-4 w-4 text-muted-foreground"}
          />
        </button>
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
          <ProductScrollMedia product={product} />
        </Link>
        <div className="absolute inset-x-4 bottom-4 translate-y-0 opacity-100 transition-all duration-300 [@media(hover:hover)]:translate-y-3 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-y-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:translate-y-0 [@media(hover:hover)]:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => addToCart(product.slug)}
            disabled={product.availability === "out_of_stock"}
            className="btn btn-primary w-full shadow-lift"
          >
            {product.availability === "out_of_stock" ? "Out of stock" : "Add to cart"}
          </button>
        </div>
      </div>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {product.category}
      </p>
      <h3 className="mt-2 text-base font-semibold leading-snug">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="hover:text-glow">
          {product.name}
        </Link>
      </h3>
      <div className="mt-2 flex items-baseline gap-2.5">
        <span
          className={`tabular text-lg font-bold ${product.was ? "text-deal" : "text-foreground"}`}
        >
          {formatPrice(product.price)}
        </span>
        {product.was && (
          <span className="tabular text-sm text-muted-foreground line-through">
            {formatPrice(product.was)}
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
