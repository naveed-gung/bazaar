import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BellPlus,
  ChevronRight,
  Heart,
  ListFilter,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ImageGallery } from "@/components/image-gallery";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { ReviewList, ReviewSummary, type ReviewItem } from "@/components/review-list";
import { SpecSheet } from "@/components/spec-sheet";
import { StarInput } from "@/components/star-input";
import { VariantPicker } from "@/components/variant-picker";
import { AvailabilityTag, Pill, Rating, Skeleton } from "@/components/ui";
import { showToast } from "@/components/toast";
import { formatPrice, formatPriceRange } from "@/lib/products";
import { useStore } from "@/lib/store";
import {
  api,
  ApiError,
  fromApiProduct,
  registerStockAlert,
  useAuthStatus,
  useCatalogFacets,
  useProductReviews,
  useRecordViewed,
  useReviewVote,
  useRecentlyViewed,
  type CatalogProduct,
} from "@/lib/api";

export const Route = createFileRoute("/product/$slug")({
  validateSearch: (
    search: Record<string, unknown>,
  ): Record<`opt.${string}`, string | undefined> => {
    const out: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(search)) {
      if (key.startsWith("opt.") && typeof value === "string" && value) out[key] = value;
    }
    return out;
  },
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

/** The public detail endpoint currently returns one legacy variant stub;
    normalise defensively so the full matrix lights this page up when it lands. */
type ResolvedVariant = {
  id: string;
  optionValues: Record<string, string>;
  availability: number;
  price: number;
  imageIndex: number;
};

function normalizeVariants(product: CatalogProduct): ResolvedVariant[] {
  const raw: unknown = product.variants;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const record = entry as Record<string, unknown>;
    const optionValues = (record["optionValues"] ?? record["options"] ?? {}) as Record<
      string,
      string
    >;
    const money = record["price"] as { amountMinor?: number } | undefined;
    const price =
      typeof money?.amountMinor === "number"
        ? money.amountMinor / 100
        : Number(record["price"] ?? 0) || product.priceRange.min.amountMinor / 100;
    return {
      id: String(record["id"] ?? ""),
      optionValues,
      availability: Number(record["quantityAvailable"] ?? record["availability"] ?? 0),
      price,
      imageIndex: Number(record["imageIndex"] ?? 0),
    };
  });
}

function tierOf(quantity: number): "in_stock" | "low_stock" | "out_of_stock" {
  if (quantity <= 0) return "out_of_stock";
  return quantity <= 5 ? "low_stock" : "in_stock";
}

/** Numbered Swiss section header: 3px ink rule, red index eyebrow, display title. */
function RuledSectionHeader({
  id,
  index,
  label,
  title,
  copy,
  actions,
}: {
  id?: string;
  index: string;
  label: string;
  title: string;
  copy?: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className="rule-strong" />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-2xl">
          <span className="eyebrow">
            {index} — {label}
          </span>
          <h2
            {...(id ? { id } : {})}
            className="font-display mt-3 text-2xl font-bold tracking-tight uppercase lg:text-4xl"
          >
            {title}
          </h2>
          {copy && (
            <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">{copy}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </>
  );
}

function ProductPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const productQuery = useQuery({
    queryKey: ["product", slug],
    queryFn: () => api<CatalogProduct>(`/catalog/products/${encodeURIComponent(slug)}`),
  });
  const { addToCart, toggleWishlist, isWishlisted, openCart } = useStore();
  const auth = useAuthStatus();
  const [compareStatus, setCompareStatus] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [alertState, setAlertState] = useState<"idle" | "done">("idle");

  const product = productQuery.data ?? null;
  const variants = useMemo(() => (product ? normalizeVariants(product) : []), [product]);
  const axes = useMemo(() => product?.options ?? [], [product]);

  // Selection lives in the URL (`opt.<Name>=<Value>`) so an exact choice is shareable.
  const selection = useMemo(() => {
    const chosen: Record<string, string> = {};
    for (const [key, value] of Object.entries(search)) {
      if (key.startsWith("opt.") && value) chosen[key.slice("opt.".length)] = value;
    }
    return chosen;
  }, [search]);

  function pickOption(name: string, value: string) {
    const next: Record<string, string | undefined> = {};
    for (const axis of axes) {
      next[`opt.${axis.name}`] = axis.name === name ? value : (selection[axis.name] ?? undefined);
    }
    void navigate({ to: "/product/$slug", params: { slug }, search: next });
  }

  const matched = useMemo(
    () =>
      variants.find((variant) =>
        axes.every(
          (axis) =>
            !selection[axis.name] || variant.optionValues[axis.name] === selection[axis.name],
        ),
      ) ?? null,
    [variants, axes, selection],
  );

  const galleryImages = useMemo(
    () =>
      (product?.images ?? []).map((image) => ({
        src: image.url,
        srcSet: image.sources.map((source) => `${source.url} ${source.width}w`).join(", "),
        alt: image.alt || product?.name || "",
      })),
    [product],
  );

  const activeImage = matched ? matched.imageIndex : undefined;
  const displayPrice = matched
    ? matched.price
    : product
      ? product.priceRange.min.amountMinor / 100
      : 0;
  const rangeLow = product ? product.priceRange.min.amountMinor / 100 : 0;
  const rangeHigh = product ? product.priceRange.max.amountMinor / 100 : 0;
  const hasRange = rangeHigh > rangeLow;
  const effectiveTier = matched
    ? tierOf(matched.availability)
    : (product?.availability ?? "out_of_stock");
  const soldOut = effectiveTier === "out_of_stock";
  const wished = product ? isWishlisted(product.slug) : false;

  // API-04: record the view once per mount, then render the rail excluding this page.
  const recordViewed = useRecordViewed();
  useEffect(() => {
    if (productQuery.isSuccess) recordViewed.mutate(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, productQuery.isSuccess]);

  const viewedQuery = useRecentlyViewed(slug);
  const relatedQuery = useCatalogFacets(
    product ? { category: product.categorySlug, limit: "5" } : {},
  );
  const related = (relatedQuery.data?.items ?? [])
    .filter((item) => item.slug !== slug)
    .slice(0, 4)
    .map(fromApiProduct);

  if (productQuery.isPending) return <ProductSkeleton />;
  if (productQuery.error || !product)
    return (
      <main className="shell mx-auto min-h-[60vh] py-20">
        <p role="alert" className="text-destructive">
          {productQuery.error?.message ?? "Product not found."}
        </p>
        <Link to="/shop" className="btn btn-primary mt-6">
          Back to shop
        </Link>
      </main>
    );

  const savedPct = product.compareAtPrice
    ? Math.round((1 - product.price.amountMinor / product.compareAtPrice.amountMinor) * 100)
    : 0;

  return (
    <>
      {/* Buy spread — gallery 7 / panel 5 on lg */}
      <section className="shell pt-10 pb-16 lg:pt-14 lg:pb-20">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Shop", to: "/shop" },
            { label: product.category, to: `/categories/${product.categorySlug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="relative lg:col-span-7">
            {product.badge && (
              <span className="pill absolute left-5 top-5 z-10 border-transparent bg-accent text-accent-foreground">
                {product.badge}
                {product.badge === "Deal" && savedPct > 0 ? ` −${savedPct}%` : ""}
              </span>
            )}
            <ImageGallery images={galleryImages} name={product.name} activeIndex={activeImage} />
          </div>

          <div className="lg:sticky lg:top-24 lg:col-span-5">
            <span className="eyebrow">{product.brand}</span>
            <Link
              to="/categories/$slug"
              params={{ slug: product.categorySlug }}
              className="mt-3 inline-flex text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {product.category}
            </Link>
            <h1 className="headline mt-4 text-[clamp(1.875rem,3.2vw,2.75rem)]">{product.name}</h1>
            <Rating rating={product.rating} reviews={product.reviewCount} className="mt-4" />

            <div className="mt-6" aria-live="polite">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <span className="price tabular text-4xl leading-none font-bold lg:text-5xl">
                  {hasRange && !matched
                    ? formatPriceRange(rangeLow, rangeHigh)
                    : formatPrice(displayPrice)}
                </span>
                {product.compareAtPrice && (
                  <>
                    <span className="price tabular text-lg text-muted-foreground line-through">
                      {formatPrice(product.compareAtPrice.amountMinor / 100)}
                    </span>
                    {savedPct > 0 && <Pill tone="deal">Save {savedPct}%</Pill>}
                  </>
                )}
              </div>
              <AvailabilityTag availability={effectiveTier} className="mt-4" />
              {matched && matched.availability > 0 && (
                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {matched.availability} units ready to ship
                </p>
              )}
            </div>

            <p className="measure mt-6 text-base leading-relaxed text-muted-foreground">
              {product.blurb}
            </p>

            {axes.length > 0 && variants.length > 0 && (
              <VariantPicker
                className="mt-8"
                options={axes.map((axis) => ({ name: axis.name, values: axis.values }))}
                variants={variants.map((variant) => ({
                  id: variant.id,
                  optionValues: variant.optionValues,
                  availability: variant.availability,
                  price: variant.price,
                }))}
                value={selection}
                onChange={(next) => {
                  const changed = Object.entries(next).find(
                    ([name, value]) => selection[name] !== value,
                  );
                  if (changed) pickOption(changed[0], changed[1]);
                }}
                formatPrice={formatPrice}
              />
            )}

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  addToCart(product.slug);
                  openCart();
                }}
                disabled={soldOut}
                className="btn btn-primary btn-lg w-full"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                {soldOut ? "Out of stock" : "Add to cart"}
              </button>
              <button
                type="button"
                onClick={() => toggleWishlist(product.slug)}
                aria-pressed={wished}
                className="btn btn-quiet btn-lg w-full"
              >
                <Heart
                  className={wished ? "h-4 w-4 fill-accent text-accent" : "h-4 w-4"}
                  aria-hidden="true"
                />
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
                className="btn btn-quiet btn-lg w-full"
              >
                <Scale className="h-4 w-4" aria-hidden="true" />
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

            {soldOut && <StockAlertPanel />}

            {product.specs && product.specs.length > 0 && (
              <a href="#specifications" className="btn btn-ghost btn-sm mt-4 -ml-3.5">
                <ListFilter className="h-4 w-4" aria-hidden="true" />
                See all {product.specs.length} specifications
              </a>
            )}

            <ul className="mt-8 grid gap-3 border-t border-border pt-8 sm:grid-cols-3">
              {TRUST.map((item) => (
                <li key={item.title} className="flex gap-3">
                  <item.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold tracking-[0.08em] uppercase">{item.title}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{item.copy}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 01 — Specifications */}
      <section
        id="specifications"
        className="shell pb-20 lg:pb-28"
        aria-labelledby="specifications-heading"
      >
        <RuledSectionHeader
          id="specifications-heading"
          index="01"
          label="Specifications"
          title="What you actually get"
          copy="Published catalog values for this exact product revision — no marketing rounding."
          actions={
            <Link to="/compare" className="btn btn-quiet btn-sm">
              <Scale className="h-4 w-4" aria-hidden="true" />
              Compare side by side
            </Link>
          }
        />
        <SpecSheet specs={product.specs ?? []} className="mt-10" />
      </section>

      {/* 02 — Reviews */}
      <ReviewsSection
        slug={slug}
        authenticated={Boolean(auth.data?.authenticated)}
        authPending={auth.isPending}
      />

      {/* 03 — Recently viewed */}
      {(viewedQuery.data?.length ?? 0) > 0 && (
        <section className="shell pb-20 lg:pb-28" aria-labelledby="viewed-heading">
          <RuledSectionHeader
            id="viewed-heading"
            index="03"
            label="Your Trail"
            title="Recently viewed"
          />
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
            {(viewedQuery.data ?? []).slice(0, 4).map((summary, index) => (
              <Reveal key={summary.slug} delay={index * 60}>
                <ProductCard product={fromApiProduct(summary)} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* 04 — Related */}
      {related.length > 0 && (
        <section className="shell pb-20 lg:pb-28">
          <RuledSectionHeader
            index="04"
            label="Related"
            title="You may also like"
            actions={
              <Link
                to="/categories/$slug"
                params={{ slug: product.categorySlug }}
                className="btn btn-quiet btn-sm"
              >
                All {product.category}
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
            {related.map((entry) => (
              <ProductCard key={entry.slug} product={entry} />
            ))}
          </div>
        </section>
      )}

      {/* Mobile buy bar — the sticky desktop panel's counterpart. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-rule bg-background p-3 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="price tabular truncate text-base font-bold">
              {hasRange && !matched
                ? formatPriceRange(rangeLow, rangeHigh)
                : formatPrice(displayPrice)}
            </p>
            <AvailabilityTag availability={effectiveTier} />
          </div>
          <button
            type="button"
            onClick={() => {
              addToCart(product.slug);
              openCart();
            }}
            disabled={soldOut}
            className="btn btn-primary ml-auto shrink-0"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {soldOut ? "Sold out" : "Add"}
          </button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </>
  );

  /** API-05 self-service alert; sign-in is required by the backend contract. */
  function StockAlertPanel() {
    const alertMutation = useMutation({
      mutationFn: () =>
        registerStockAlert(slug, {
          ...(matched?.id ? { variantId: matched.id } : {}),
          ...(alertEmail.trim() ? { email: alertEmail.trim() } : {}),
        }),
      onSuccess: () => {
        setAlertState("done");
        showToast("success", "Stock alert registered", "We will flag it the moment restock lands.");
      },
      onError: (caught) =>
        showToast(
          "error",
          "Could not register alert",
          caught instanceof Error ? caught.message : undefined,
        ),
    });

    if (alertState === "done")
      return (
        <p className="panel mt-6 p-4 text-sm text-muted-foreground" role="status">
          Alert active for this product — restock resolution is tracked server-side.
        </p>
      );

    if (!auth.data?.authenticated)
      return (
        <div className="panel mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 text-sm">
            <BellPlus className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Sign in to get told when this is back.
          </p>
          <Link to="/login" className="btn btn-quiet btn-sm shrink-0">
            Sign in
          </Link>
        </div>
      );

    return (
      <div className="panel mt-6 p-4">
        <label
          htmlFor="stock-alert-email"
          className="flex items-center gap-2.5 text-sm font-medium"
        >
          <BellPlus className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
          Notify me when back in stock
        </label>
        <div className="mt-3 flex gap-2">
          <input
            id="stock-alert-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={alertEmail}
            onChange={(event) => setAlertEmail(event.target.value)}
            className="field"
          />
          <button
            type="button"
            onClick={() => alertMutation.mutate()}
            disabled={alertMutation.isPending}
            className="btn btn-quiet shrink-0"
          >
            {alertMutation.isPending ? "Saving…" : "Register"}
          </button>
        </div>
        <p className="field-help">Optional email — the alert is stored against your account.</p>
      </div>
    );
  }
}

function ReviewsSection({
  slug,
  authenticated,
  authPending,
}: {
  slug: string;
  authenticated: boolean;
  authPending: boolean;
}) {
  const reviewsQuery = useProductReviews(slug);
  const vote = useReviewVote(slug);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      api<{ state: string }>(`/products/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, title, body }),
      }),
    onSuccess: () => {
      setRating(0);
      setTitle("");
      setBody("");
      setFormError("");
      showToast("info", "Review received", "It appears once moderation publishes it.");
    },
    onError: (caught) =>
      setFormError(caught instanceof Error ? caught.message : "The review could not be submitted."),
  });

  const items: ReviewItem[] = (reviewsQuery.data?.reviews ?? []).map((review) => ({
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    date: new Date(review.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" }),
    title: review.title,
    body: review.body,
    verified: review.verifiedPurchase,
    helpfulCount: review.helpfulCount,
    votedHelpful: review.votedHelpful,
  }));

  return (
    <section id="reviews" className="shell pb-20 lg:pb-28" aria-labelledby="reviews-heading">
      <RuledSectionHeader
        id="reviews-heading"
        index="02"
        label="Reviews"
        title="What owners report back"
        actions={
          <a href="#write-review" className="btn btn-quiet btn-sm">
            Write a review
          </a>
        }
      />
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-4">
          {reviewsQuery.isPending ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ReviewSummary summary={reviewsQuery.data?.summary ?? FALLBACK_SUMMARY} />
          )}
        </div>
        <div className="lg:col-span-8">
          {reviewsQuery.isPending ? (
            <div className="space-y-6" aria-busy="true">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No published reviews yet — be the first owner to report back.
            </p>
          ) : (
            <ReviewList
              reviews={items}
              {...(authenticated
                ? {
                    onVote: (reviewId: string, helpful: boolean) =>
                      vote.mutate({ reviewId, helpful }),
                  }
                : {})}
            />
          )}

          <div id="write-review" className="panel mt-12 scroll-mt-28">
            <div className="p-6 lg:p-8">
              <h3 className="font-display text-lg font-semibold tracking-tight">Write a review</h3>
              {!authPending && !authenticated ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Reviews are tied to delivered purchases, so{" "}
                  <Link to="/login" className="font-semibold text-accent underline">
                    sign in
                  </Link>{" "}
                  with the account that placed the order.
                </p>
              ) : (
                <form
                  className="mt-5 space-y-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!rating) {
                      setFormError("Pick a star rating first.");
                      return;
                    }
                    submit.mutate();
                  }}
                >
                  <div>
                    <span className="text-sm font-medium">Your rating</span>
                    <StarInput value={rating} onChange={setRating} className="mt-2" />
                  </div>
                  <label className="block text-sm">
                    <span className="font-medium">Headline</span>
                    <input
                      type="text"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      minLength={2}
                      maxLength={120}
                      required
                      className="field mt-2"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Your review</span>
                    <textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      minLength={10}
                      maxLength={2000}
                      rows={5}
                      required
                      className="field mt-2"
                    />
                    <span className="field-help">
                      Verified purchases only — the server checks the order history.
                    </span>
                  </label>
                  {formError && (
                    <p role="alert" className="field-error">
                      {formError}
                    </p>
                  )}
                  <button type="submit" disabled={submit.isPending} className="btn btn-primary">
                    {submit.isPending ? "Submitting…" : "Submit review"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FALLBACK_SUMMARY = {
  rating: 0,
  reviewCount: 0,
  distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
};

function ProductSkeleton() {
  return (
    <section className="shell py-14 lg:py-20" aria-busy="true" aria-live="polite">
      <Skeleton className="h-3 w-56" />
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
        <Skeleton className="aspect-square w-full lg:col-span-7" />
        <div className="lg:col-span-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-6 h-12 w-4/5" />
          <Skeleton className="mt-3 h-12 w-1/2" />
          <Skeleton className="mt-7 h-4 w-44" />
          <Skeleton className="mt-7 h-12 w-52" />
          <Skeleton className="mt-6 h-16 w-full" />
          <div className="mt-8 flex flex-col gap-3">
            <Skeleton className="h-13 w-full" />
            <Skeleton className="h-13 w-full" />
            <Skeleton className="h-13 w-full" />
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
