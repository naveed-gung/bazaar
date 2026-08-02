import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, Heart, ShoppingBag, Truck, ShieldCheck, Scale } from "lucide-react";
import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";
import { api, fromApiProduct, type CatalogProduct } from "@/lib/api";
import { ProductCinematic } from "@/components/product-scroll-media";

export const Route = createFileRoute("/product/$slug")({
  head: () => {
    return {
      meta: [
        { title: "Product — Bazaar" },
        { name: "description", content: "Server-authoritative Bazaar product details." },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<CatalogProduct>(`/catalog/products/${encodeURIComponent(slug)}`),
  });
  const { addToCart, toggleWishlist, isWishlisted } = useStore();
  const [compareStatus, setCompareStatus] = useState("");
  const product = productQuery.data ? fromApiProduct(productQuery.data) : null;
  const relatedQuery = useQuery({
    queryKey: ["related-products", product?.categorySlug],
    enabled: Boolean(product),
    queryFn: () =>
      api<{ items: CatalogProduct[] }>(
        `/catalog/products?category=${encodeURIComponent(product!.categorySlug)}&limit=5`,
      ),
  });
  const related = (relatedQuery.data?.items ?? [])
    .filter((item) => item.slug !== slug)
    .map(fromApiProduct);

  if (productQuery.isPending)
    return (
      <main className="mx-auto min-h-[60vh] max-w-[1600px] px-6 py-20 text-sm text-muted-foreground">
        Loading product…
      </main>
    );
  if (productQuery.error || !product)
    return (
      <main className="mx-auto min-h-[60vh] max-w-[1600px] px-6 py-20">
        <p role="alert" className="text-destructive">
          {productQuery.error?.message ?? "Product not found."}
        </p>
        <Link
          to="/shop"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground"
        >
          Back to shop
        </Link>
      </main>
    );

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-6 py-14 lg:px-10 lg:py-20">
        <nav className="flex items-center gap-2 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <span>/</span>
          <span className="text-foreground">{product.name}</span>
        </nav>

        <div className="mt-10 grid gap-14 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <img
              src={product.img}
              alt={product.name}
              width={700}
              height={700}
              className="aspect-square h-full w-full object-cover"
            />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-glow">
              {product.category}
            </p>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-5xl">
              {product.name}
            </h1>
            <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < product.rating ? "fill-glow text-glow" : "text-border"}`}
                  />
                ))}
              </span>
              {product.reviews} reviews
            </div>
            <div className="mt-7 flex items-end gap-4">
              <span className="text-3xl font-extrabold lg:text-4xl">
                {formatPrice(product.price)}
              </span>
              {product.was && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.was)}
                </span>
              )}
            </div>
            <p className="mt-7 text-base leading-relaxed text-muted-foreground">{product.blurb}</p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => addToCart(product.slug)}
                disabled={product.availability === "out_of_stock"}
                className="inline-flex items-center gap-2 rounded-xl bg-signal px-8 py-4 text-sm font-semibold text-signal-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:hover:translate-y-0"
              >
                <ShoppingBag className="h-4 w-4" />{" "}
                {product.availability === "out_of_stock" ? "Out of stock" : "Add to Cart"}
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.slug)}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-8 py-4 text-sm font-medium text-muted-foreground hover:border-signal hover:text-foreground"
              >
                <Heart
                  className={`h-4 w-4 ${isWishlisted(product.slug) ? "fill-glow text-glow" : ""}`}
                />
                {isWishlisted(product.slug) ? "Saved" : "Save"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api(`/comparison/${encodeURIComponent(product.slug)}`, { method: "PUT" });
                    setCompareStatus("Added to comparison");
                  } catch (caught) {
                    setCompareStatus(
                      caught instanceof Error ? caught.message : "Could not compare.",
                    );
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-6 text-sm font-medium text-muted-foreground hover:border-signal hover:text-foreground"
              >
                <Scale className="h-4 w-4" /> Compare
              </button>
            </div>
            {compareStatus && (
              <p className="mt-3 text-sm text-muted-foreground" aria-live="polite">
                {compareStatus} ·{" "}
                <Link to="/compare" className="underline">
                  View comparison
                </Link>
              </p>
            )}

            <dl className="mt-10 grid gap-x-8 gap-y-4 border-t border-border pt-8 sm:grid-cols-2">
              {product.specs.map((spec: { label: string; value: string }) => (
                <div key={spec.label} className="flex justify-between gap-4 text-sm">
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd className="font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <Truck className="h-5 w-5 shrink-0 text-glow" /> Free shipping over $50
              </p>
              <p className="flex items-center gap-3 text-sm text-muted-foreground">
                <ShieldCheck className="h-5 w-5 shrink-0 text-glow" /> 30-day money back
              </p>
            </div>
          </div>
        </div>
      </section>

      <ProductCinematic product={product} />

      {related.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-6 pb-24 lg:px-10">
          <h2 className="text-2xl font-extrabold tracking-tight lg:text-3xl">You may also like</h2>
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
