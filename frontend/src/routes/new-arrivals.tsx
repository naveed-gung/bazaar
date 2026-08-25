import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
import { fromApiProduct, useCatalogProducts } from "@/lib/api";

export const Route = createFileRoute("/new-arrivals")({
  head: () => ({
    meta: [
      { title: "New Arrivals — Bazaar" },
      {
        name: "description",
        content:
          "The newest additions to Bazaar: fresh wearables, cameras and gaming hardware built for the modern digital age.",
      },
      { property: "og:title", content: "New Arrivals — Bazaar" },
      { property: "og:description", content: "Just landed at Bazaar." },
    ],
  }),
  component: NewArrivals,
});

function NewArrivals() {
  const catalog = useCatalogProducts({ badge: "New" });
  const list = (catalog.data?.items ?? []).map(fromApiProduct);

  return (
    <>
      {/* 01 — New arrivals header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "New Arrivals" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — New Arrivals</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Just Landed</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            The latest devices to pass our review process — new hardware, new firmware, same
            guarantee.
          </p>
        </div>
      </section>

      {/* 02 — This week's arrivals */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — This Week</span>

        {catalog.error ? (
          <div className="panel mt-8 p-7">
            <p role="alert" className="text-sm text-destructive">
              {catalog.error.message}
            </p>
          </div>
        ) : catalog.isPending ? (
          <div className="mt-10">
            <ProductGridSkeleton count={8} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title="Nothing new this week"
            copy="Everything currently in the catalog has been here a while. The full range is still worth a look."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse all products
              </Link>
            }
            className="mt-8"
          />
        ) : (
          <>
            <p className="mt-8 flex items-baseline gap-3" aria-live="polite">
              <span className="price tabular text-5xl leading-none font-bold">{list.length}</span>
              <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                new {list.length === 1 ? "arrival" : "arrivals"}
              </span>
            </p>
            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
              {list.map((p, i) => (
                <Reveal key={p.slug} delay={i * 70}>
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
