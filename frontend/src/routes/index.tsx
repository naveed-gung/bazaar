import { Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { INDEX_ROW_ROLL, Reveal, Stagger } from "@/components/motion";
import { ProductCard } from "@/components/product-card";
import { EmptyState, ProductCardSkeleton, Skeleton } from "@/components/ui";
import { fromApiProduct, useCatalogCategories, useCatalogProducts } from "@/lib/api";
import bannerAudio from "@/assets/banner-audio.jpg";
// SSR-40 — Pexels #4523056 by Polina Tankilevitch (credit recorded in
// docs/agent/10-swiss-signal.md for the README licensing section).
import heroStill from "@/assets/hero-desk.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bazaar — Everyday tech, without noise" },
      {
        name: "description",
        content:
          "A deliberately short catalogue of keyboards, audio, cameras and smart home. Free shipping over $50, 30-day returns, secure encrypted checkout.",
      },
      { property: "og:title", content: "Bazaar — Everyday tech, without noise" },
      {
        property: "og:description",
        content:
          "Keyboards, audio, cameras and smart home, priced plainly. Free shipping over $50, 30-day returns, secure encrypted checkout.",
      },
    ],
  }),
  component: Home,
});

const tickerItems = [
  "Free shipping over $50",
  "30-day returns",
  "Secure checkout, encrypted end to end",
  "New drops weekly",
];

const trustColumns = [
  {
    label: "Payments",
    body: "Checkout is encrypted end to end. Your payment travels over a secured connection from cart to confirmation.",
  },
  {
    label: "Shipping",
    body: "Free shipping on orders over $50. Metro deliveries typically arrive within 48 hours of dispatch.",
  },
  {
    label: "Returns",
    body: "30 days to change your mind on everything, no questions asked. Start a return from your account.",
  },
  {
    label: "Support",
    body: "Real people answer within one business day — write to support or use the contact form.",
  },
];

/** One marquee run. Items repeat so a single run always clears the 1440px shell. */
function TickerRun({ silent = false }: { silent?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-12" aria-hidden={silent || undefined}>
      {[...tickerItems, ...tickerItems].map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          <span className="ticker-item">{item}</span>
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
        </Fragment>
      ))}
    </div>
  );
}

function QueryErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel p-7">
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <button type="button" onClick={onRetry} className="btn btn-quiet mt-6">
        Try again
      </button>
    </div>
  );
}

function Home() {
  const featured = useCatalogProducts({ limit: "8" });
  const deals = useCatalogProducts({ badge: "Deal", limit: "4" });
  const categories = useCatalogCategories();

  const featuredItems = (featured.data?.items ?? []).map(fromApiProduct);
  const dealItems = (deals.data?.items ?? []).map(fromApiProduct);
  const categoryItems = categories.data ?? [];

  return (
    <>
      {/* 01 — Typographic hero (text block first, then the figure rises in behind it) */}
      <section className="shell pt-14 pb-16 lg:pt-24 lg:pb-20">
        <Reveal delay={0}>
          <span className="eyebrow">01 — New Season</span>
          <h1 className="headline mt-8">
            <span className="block">Everyday</span>
            <span className="block">Tech,</span>
            <span className="block">Without Noise.</span>
          </h1>
          <p className="measure mt-10 text-base leading-relaxed text-muted-foreground lg:text-lg">
            Keyboards, audio, cameras and smart home — a short catalogue of things that work quietly
            and outlast the hype cycle. Priced plainly, shipped fast, returned without friction.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/shop" className="btn btn-primary btn-lg">
              Shop the catalogue
            </Link>
            <Link to="/deals" className="btn btn-quiet btn-lg">
              Today's deals
            </Link>
          </div>
        </Reveal>
        <figure className="mt-16 lg:mt-24">
          <Reveal delay={120}>
            <img
              src={heroStill}
              alt="Black headphones, a white keyboard and a dark tablet arranged on a white marble desk"
              width={1920}
              height={1280}
              loading="eager"
              decoding="async"
              className="h-auto w-full object-cover"
            />
            <figcaption className="mt-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Fig. 01 — The working desk
            </figcaption>
          </Reveal>
        </figure>
      </section>

      {/* Store notices ticker */}
      <section aria-label="Store notices" className="ticker">
        <div className="ticker-track">
          <TickerRun />
          <TickerRun silent />
        </div>
      </section>

      {/* 02 — Category index list */}
      <section className="shell py-20 lg:py-28" aria-labelledby="home-categories-title">
        <div className="rule-strong" />
        <Reveal>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div>
              <span className="eyebrow">02 — Catalogue Index</span>
              <h2
                id="home-categories-title"
                className="font-display mt-3 text-3xl font-bold tracking-tight uppercase lg:text-5xl"
              >
                Every collection
              </h2>
            </div>
            <Link to="/categories" className="btn btn-quiet">
              All categories <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>

        <div className="mt-12" aria-busy={categories.isPending || undefined}>
          {categories.isPending ? (
            <div aria-hidden="true">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="flex items-center gap-6 border-b border-border py-5">
                  <Skeleton className="h-3 w-7" />
                  <Skeleton className="h-6 w-44 max-w-full" />
                  <Skeleton className="ml-auto h-3 w-24" />
                </div>
              ))}
            </div>
          ) : categories.error ? (
            <QueryErrorPanel
              message={categories.error.message}
              onRetry={() => void categories.refetch()}
            />
          ) : categoryItems.length === 0 ? (
            <EmptyState
              title="No collections yet"
              copy="The catalogue is being restocked. Everything lands here first."
              action={
                <Link to="/shop" className="btn btn-quiet">
                  Browse everything
                </Link>
              }
            />
          ) : (
            <nav aria-label="Shop by category">
              <Stagger step={40}>
                {categoryItems.map((category, index) => (
                  <Link
                    key={category.slug}
                    to="/categories/$slug"
                    params={{ slug: category.slug }}
                    className="index-row group"
                  >
                    <span className="index-row-num">{String(index + 1).padStart(2, "0")}</span>
                    <span className="index-row-label h-[1.2em] overflow-hidden">
                      <span className={`block ${INDEX_ROW_ROLL}`}>{category.name}</span>
                      <span aria-hidden="true" className={`block text-accent ${INDEX_ROW_ROLL}`}>
                        {category.name}
                      </span>
                    </span>
                    <span className="index-row-meta">Collection</span>
                    <ArrowRight className="index-row-arrow h-5 w-5" aria-hidden="true" />
                  </Link>
                ))}
              </Stagger>
            </nav>
          )}
        </div>
      </section>

      {/* 03 — Featured rail */}
      <section className="shell pb-20 lg:pb-28" aria-labelledby="home-featured-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <header className="lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <div className="rule-strong" />
                <span className="eyebrow mt-6">03 — Featured</span>
                <h2
                  id="home-featured-title"
                  className="font-display mt-3 text-3xl font-bold tracking-tight uppercase lg:text-4xl"
                >
                  This week's picks
                </h2>
                <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">
                  Eight products ranked by the catalogue's own feature score — what is actually
                  worth your money right now, nothing else.
                </p>
                <Link to="/shop" className="btn btn-quiet mt-8">
                  View all products <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Reveal>
            </div>
          </header>
          <div className="lg:col-span-8">
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8 xl:grid-cols-3"
              aria-busy={featured.isPending || undefined}
            >
              {featured.isPending ? (
                Array.from({ length: 6 }).map((_, index) => <ProductCardSkeleton key={index} />)
              ) : featured.error ? (
                <div className="col-span-full">
                  <QueryErrorPanel
                    message={featured.error.message}
                    onRetry={() => void featured.refetch()}
                  />
                </div>
              ) : featuredItems.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    title="Nothing featured this week"
                    copy="The editors are between picks. The full catalogue is still open."
                    action={
                      <Link to="/shop" className="btn btn-quiet">
                        Browse the catalogue
                      </Link>
                    }
                  />
                </div>
              ) : (
                <Stagger className="contents">
                  {featuredItems.map((product) => (
                    <ProductCard key={product.slug} product={product} />
                  ))}
                </Stagger>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 04 — Deals rail (mirrored split) */}
      <section className="shell pb-20 lg:pb-28" aria-labelledby="home-deals-title">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <header className="lg:order-2 lg:col-span-4">
            <div className="lg:sticky lg:top-32">
              <Reveal>
                <div className="rule-strong" />
                <span className="eyebrow mt-6">04 — Deals</span>
                <h2
                  id="home-deals-title"
                  className="font-display mt-3 text-3xl font-bold tracking-tight uppercase lg:text-4xl"
                >
                  Marked down, not marked up
                </h2>
                <p className="measure mt-4 text-sm leading-relaxed text-muted-foreground">
                  Live price cuts across the catalogue. The struck-through figure is what it cost
                  yesterday; the red one is what it costs today.
                </p>
                <Link to="/deals" className="btn btn-quiet mt-8">
                  All deals <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Reveal>
            </div>
          </header>
          <div className="lg:order-1 lg:col-span-8">
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-12 sm:gap-x-8"
              aria-busy={deals.isPending || undefined}
            >
              {deals.isPending ? (
                Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={index} />)
              ) : deals.error ? (
                <div className="col-span-full">
                  <QueryErrorPanel
                    message={deals.error.message}
                    onRetry={() => void deals.refetch()}
                  />
                </div>
              ) : dealItems.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState
                    title="No live deals right now"
                    copy="Price cuts return with the next drop. New arrivals ship at full price."
                    action={
                      <Link to="/new-arrivals" className="btn btn-quiet">
                        See new arrivals
                      </Link>
                    }
                  />
                </div>
              ) : (
                <Stagger className="contents">
                  {dealItems.map((product) => (
                    <ProductCard key={product.slug} product={product} />
                  ))}
                </Stagger>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 05 — Full-bleed split promo band */}
      <section
        aria-labelledby="home-drop-title"
        className="grid bg-foreground text-background lg:grid-cols-2"
      >
        <div className="relative min-h-72 lg:min-h-0">
          <Reveal className="absolute inset-0">
            <img
              src={bannerAudio}
              alt="Wireless earbuds resting on a dark platform"
              width={1100}
              height={640}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </Reveal>
        </div>
        <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-16 lg:py-28">
          <Reveal>
            <span className="eyebrow text-signal-foreground">05 — Signal Drop</span>
            <h2
              id="home-drop-title"
              className="font-display mt-6 text-4xl leading-[0.95] font-black tracking-tight uppercase lg:text-6xl"
            >
              Up to 40% off audio
            </h2>
            <p className="measure mt-6 text-sm leading-relaxed text-background/80">
              Selected headphones, earbuds and studio monitors while stock lasts. Prices shown are
              the prices you pay.
            </p>
            <div className="mt-10">
              <Link
                to="/deals"
                className="btn border-background bg-background text-foreground hover:bg-transparent hover:text-background"
              >
                Shop the drop <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 06 — Trust strip */}
      <section
        className="shell pt-20 pb-24 lg:pt-28 lg:pb-32"
        aria-labelledby="home-fineprint-title"
      >
        <div className="rule-strong" />
        <Reveal>
          <div className="mt-6">
            <span className="eyebrow">06 — The Fine Print</span>
            <h2
              id="home-fineprint-title"
              className="font-display mt-3 text-2xl font-bold tracking-tight uppercase lg:text-3xl"
            >
              Plain terms
            </h2>
          </div>
        </Reveal>
        <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stagger className="contents">
            {trustColumns.map((column) => (
              <div key={column.label} className="bg-background p-8">
                <h3 className="text-xs font-bold uppercase tracking-[0.14em]">{column.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{column.body}</p>
              </div>
            ))}
          </Stagger>
        </div>
      </section>
    </>
  );
}
