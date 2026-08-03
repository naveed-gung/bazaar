import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { PageHero } from "@/components/page-hero";
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
      <PageHero
        eyebrow="New Arrivals"
        title="Just Landed"
        copy="The latest devices to pass our review process — new hardware, new firmware, same guarantee."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {catalog.error ? (
          <p role="alert" className="text-sm text-destructive">
            {catalog.error.message}
          </p>
        ) : catalog.isPending ? (
          <ProductGridSkeleton count={8} />
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
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="tabular font-semibold text-foreground">{list.length}</span> new{" "}
              {list.length === 1 ? "arrival" : "arrivals"}
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
