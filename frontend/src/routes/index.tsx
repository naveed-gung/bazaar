import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Truck, Headphones, ShieldCheck, Wallet } from "lucide-react";

import { HeroSlider } from "@/components/hero-slider";
import { ProductCard } from "@/components/product-card";
import { Reveal, useParallax } from "@/components/motion";
import { brands } from "@/lib/products";
import { fromApiProduct, useCatalogCategories, useCatalogProducts } from "@/lib/api";
import bannerAudio from "@/assets/banner-audio.jpg";
import bannerComputing from "@/assets/banner-computing.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bazaar — Modern Commerce for the Digital Age" },
      {
        name: "description",
        content:
          "Bazaar combines cutting-edge technology with intuitive design to create a seamless shopping journey across audio, wearables, computing and smart home.",
      },
      { property: "og:title", content: "Bazaar — Modern Commerce for the Digital Age" },
      {
        property: "og:description",
        content:
          "Cutting-edge technology meets intuitive design. Shop audio, wearables, computing, cameras and smart home at Bazaar.",
      },
    ],
  }),
  component: Home,
});

const perks = [
  { icon: Truck, title: "Free Shipping", sub: "On orders over $50" },
  { icon: Headphones, title: "24/7 Support", sub: "We are here to help" },
  { icon: ShieldCheck, title: "Secure Payment", sub: "100% secure payment" },
  { icon: Wallet, title: "Money Back", sub: "30 days guarantee" },
];

const banners = [
  {
    tag: "Season Offer",
    title: ["Up to 40%", "Off Audio"],
    sub: "On selected headphones and speakers",
    cta: "Shop Deals",
    to: "/deals" as const,
    img: bannerAudio,
    alt: "Wireless earbuds glowing on a dark platform",
  },
  {
    tag: "New Arrivals",
    title: ["Discover The", "Next Generation"],
    sub: "Fresh drops across computing and wearables",
    cta: "Explore Now",
    to: "/new-arrivals" as const,
    img: bannerComputing,
    alt: "Laptop and phone on dark glass platforms",
  },
];

function Home() {
  const catalog = useCatalogProducts({ limit: "5" });
  const categories = useCatalogCategories();
  const trending = (catalog.data?.items ?? []).map(fromApiProduct);
  const parallax = useParallax(0.12);

  return (
    <>
      <HeroSlider />

      {/* Categories */}
      <section className="mx-auto max-w-[1600px] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="grid grid-cols-3 gap-8 sm:grid-cols-6 lg:gap-10">
            {(categories.data ?? []).map((cat) => (
              <Link
                key={cat.slug}
                to="/categories/$slug"
                params={{ slug: cat.slug }}
                className="group text-center"
              >
                <div className="mx-auto aspect-square w-full max-w-[168px] overflow-hidden rounded-full border border-border bg-surface transition-all duration-500 group-hover:border-signal group-hover:shadow-glow">
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    loading="lazy"
                    width={700}
                    height={700}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                </div>
                <p className="mt-5 text-base font-bold">{cat.name}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">Browse collection</p>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Promo banners */}
      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 lg:grid-cols-2 lg:px-10">
        {banners.map((b, i) => (
          <Reveal key={b.tag} delay={i * 120}>
            <div className="group relative h-full overflow-hidden rounded-3xl border border-border bg-surface">
              <img
                src={b.img}
                alt={b.alt}
                loading="lazy"
                width={1100}
                height={640}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-background/60" />
              <div className="relative px-9 py-14 lg:px-12 lg:py-20">
                <span className="inline-block rounded-full border border-signal/40 bg-signal/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-glow">
                  {b.tag}
                </span>
                <h2 className="mt-6 text-3xl font-extrabold leading-tight tracking-tight lg:text-[2.6rem]">
                  {b.title[0]}
                  <br />
                  {b.title[1]}
                </h2>
                <p className="mt-4 text-sm text-muted-foreground">{b.sub}</p>
                <Link
                  to={b.to}
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-signal px-7 py-3.5 text-sm font-semibold text-signal-foreground transition-transform hover:-translate-y-0.5"
                >
                  {b.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Trending */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 lg:px-10 lg:py-32">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-glow">
              Curated Selection
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight lg:text-5xl">
              Trending Products
            </h2>
          </div>
          <Link
            to="/shop"
            className="flex shrink-0 items-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-signal hover:text-foreground"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5 lg:gap-10">
          {catalog.isPending && <p className="text-sm text-muted-foreground">Loading products…</p>}
          {catalog.error && (
            <p role="alert" className="text-sm text-destructive">
              {catalog.error.message}
            </p>
          )}
          {trending.map((product, i) => (
            <Reveal key={product.slug} delay={i * 90}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-20">
          <div className="grid gap-8 rounded-3xl border border-border bg-surface px-10 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
            {perks.map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex min-w-0 items-center gap-5 lg:px-8">
                <Icon className="h-7 w-7 shrink-0 text-glow" strokeWidth={1.4} />
                <div className="min-w-0">
                  <p className="truncate text-base font-bold">{title}</p>
                  <p className="truncate text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Parallax statement */}
      <section ref={parallax.ref} className="relative overflow-hidden border-y border-border">
        <div
          className="absolute inset-0 grid-noise opacity-60"
          style={{ transform: `translate3d(0, ${parallax.offset}px, 0)` }}
        />
        <div className="relative mx-auto max-w-[1600px] px-6 py-28 lg:px-10 lg:py-36">
          <Reveal>
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-glow">Why Bazaar</p>
              <h2 className="mt-6 text-3xl font-extrabold leading-[1.12] tracking-tight lg:text-[3.4rem]">
                Bazaar is redefining the e-commerce experience for the{" "}
                <span className="text-signal">modern digital age</span>.
              </h2>
              <p className="mx-auto mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground lg:text-lg">
                Our platform combines cutting-edge technology with intuitive design to create a
                seamless shopping journey — from the first tap to the final delivery.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {[
              { value: "10,000+", label: "Customers shopping every month" },
              { value: "48h", label: "Average delivery across metro areas" },
              { value: "4.9/5", label: "Verified satisfaction rating" },
            ].map((stat, i) => (
              <Reveal key={stat.value} delay={i * 120}>
                <div className="rounded-2xl border border-border bg-background/60 p-9 text-center backdrop-blur">
                  <p className="text-4xl font-extrabold tracking-tight text-glow lg:text-5xl">
                    {stat.value}
                  </p>
                  <p className="mt-4 text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Brands */}
      <section className="mx-auto max-w-[1600px] px-6 py-24 lg:px-10">
        <div className="flex items-center gap-6">
          <span className="h-px flex-1 bg-border" />
          <p className="shrink-0 text-sm text-muted-foreground">Trusted by 10,000+ Customers</p>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="mt-12 grid grid-cols-3 items-center gap-10 sm:grid-cols-6">
          {brands.map((brand) => (
            <span
              key={brand}
              className="text-center text-2xl font-extrabold tracking-tight text-muted-foreground/60 transition-colors hover:text-foreground lg:text-3xl"
            >
              {brand}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
