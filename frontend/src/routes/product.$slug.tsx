import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronRight,
  Heart,
  ListFilter,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { ProductCard } from "@/components/product-card";
import { SpecSheet } from "@/components/spec-sheet";
import { AvailabilityTag, Pill, Rating, SectionHeading, Skeleton } from "@/components/ui";
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

const TRUST = [
  { icon: Truck, title: "Free shipping over $50", copy: "Flat $7.99 below the threshold." },
  { icon: RotateCcw, title: "30-day returns", copy: "Refunds never exceed the captured amount." },
  {
    icon: ShieldCheck,
    title: "Server-priced checkout",
    copy: "Totals and stock verified on order.",
  },
];

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

  if (productQuery.isPending) return <ProductSkeleton />;
  if (productQuery.error || !product)
    return (
      <main className="mx-auto min-h-[60vh] max-w-[1600px] px-6 py-20">
        <p role="alert" className="text-destructive">
          {productQuery.error?.message ?? "Product not found."}
        </p>
        <Link to="/shop" className="btn btn-primary mt-6">
          Back to shop
        </Link>
      </main>
    );

  const soldOut = product.availability === "out_of_stock";
  const saved = product.was ? Math.round((1 - product.price / product.was) * 100) : 0;
  const wished = isWishlisted(product.slug);

  return (
    <>
      <section className="mx-auto max-w-[1600px] px-6 py-14 lg:px-10 lg:py-20">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
          <Link to="/shop" className="text-muted-foreground hover:text-foreground">
            Shop
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/60" aria-hidden="true" />
          <span className="truncate font-medium text-foreground">{product.name}</span>
        </nav>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface">
            {product.badge && (
              <span className="absolute left-5 top-5 z-10 rounded-full bg-signal px-3 py-1 text-[11px] font-bold tracking-wide text-signal-foreground">
                {product.badge === "Deal" && saved > 0 ? `-${saved}%` : product.badge}
              </span>
            )}
            <img
              src={product.img}
              alt={product.name}
              width={700}
              height={700}
              className="aspect-square h-full w-full object-cover"
            />
          </div>

          <div className="lg:sticky lg:top-28">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="signal">{product.brand}</Pill>
              <Link to="/categories/$slug" params={{ slug: product.categorySlug }}>
                <Pill className="transition-colors hover:border-signal hover:text-foreground">
                  {product.category}
                </Pill>
              </Link>
            </div>
            <h1 className="mt-5 text-3xl font-extrabold leading-[1.1] tracking-tight lg:text-[2.75rem]">
              {product.name}
            </h1>
            <Rating rating={product.rating} reviews={product.reviews} className="mt-5" />

            <div className="mt-7 flex flex-wrap items-end gap-x-4 gap-y-2">
              <span className="tabular text-3xl font-extrabold lg:text-4xl">
                {formatPrice(product.price)}
              </span>
              {product.was && (
                <>
                  <span className="tabular text-lg text-muted-foreground line-through">
                    {formatPrice(product.was)}
                  </span>
                  <Pill tone="deal">Save {saved}%</Pill>
                </>
              )}
            </div>
            <AvailabilityTag availability={product.availability} className="mt-4" />

            <p className="mt-6 text-base leading-relaxed text-muted-foreground">{product.blurb}</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => addToCart(product.slug)}
                disabled={soldOut}
                className="btn btn-primary btn-lg sm:flex-1"
              >
                <ShoppingBag className="h-4 w-4" />
                {soldOut ? "Out of stock" : "Add to cart"}
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.slug)}
                aria-pressed={wished}
                className="btn btn-quiet btn-lg"
              >
                <Heart className={wished ? "h-4 w-4 fill-signal text-signal" : "h-4 w-4"} />
                {wished ? "Saved" : "Save"}
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
                className="btn btn-quiet btn-lg"
              >
                <Scale className="h-4 w-4" />
                Compare
              </button>
            </div>
            <p className="mt-3 min-h-5 text-sm text-muted-foreground" aria-live="polite">
              {compareStatus && (
                <>
                  {compareStatus} ·{" "}
                  <Link to="/compare" className="font-medium text-foreground underline">
                    View comparison
                  </Link>
                </>
              )}
            </p>

            {product.specs.length > 0 && (
              <a href="#specifications" className="btn btn-ghost btn-sm mt-4 -ml-3.5">
                <ListFilter className="h-4 w-4" />
                See all {product.specs.length} specifications
              </a>
            )}

            <ul className="mt-8 grid gap-3 border-t border-border pt-8 sm:grid-cols-3">
              {TRUST.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-glow" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{item.title}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        id="specifications"
        className="border-t border-border bg-background py-16 lg:py-24"
        aria-labelledby="specifications-heading"
      >
        <div className="mx-auto max-w-[1600px] px-6 lg:px-10">
          <SectionHeading
            id="specifications-heading"
            eyebrow="Specifications"
            title="What you actually get"
            copy="Published catalog values for this exact product revision — no marketing rounding."
            actions={
              <Link to="/compare" className="btn btn-quiet btn-sm">
                <Scale className="h-4 w-4" />
                Compare side by side
              </Link>
            }
          />
          <SpecSheet specs={product.specs} className="mt-10" />
        </div>
      </section>

      <ProductCinematic product={product} />

      {related.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
          <SectionHeading
            eyebrow="Related"
            title="You may also like"
            actions={
              <Link
                to="/categories/$slug"
                params={{ slug: product.categorySlug }}
                className="btn btn-quiet btn-sm"
              >
                All {product.category}
                <ChevronRight className="h-4 w-4" />
              </Link>
            }
          />
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

function ProductSkeleton() {
  return (
    <section
      className="mx-auto max-w-[1600px] px-6 py-14 lg:px-10 lg:py-20"
      aria-busy="true"
      aria-live="polite"
    >
      <Skeleton className="h-3 w-56" />
      <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        <Skeleton className="aspect-square w-full rounded-3xl" />
        <div>
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="mt-6 h-10 w-4/5" />
          <Skeleton className="mt-3 h-10 w-1/2" />
          <Skeleton className="mt-7 h-4 w-44" />
          <Skeleton className="mt-7 h-9 w-52" />
          <Skeleton className="mt-6 h-16 w-full" />
          <div className="mt-8 flex flex-wrap gap-3">
            <Skeleton className="h-13 w-48 rounded-2xl" />
            <Skeleton className="h-13 w-32 rounded-2xl" />
            <Skeleton className="h-13 w-32 rounded-2xl" />
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      </div>
    </section>
  );
}
