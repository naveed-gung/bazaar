import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
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
        {catalog.isPending && <p className="text-sm text-muted-foreground">Loading arrivals…</p>}
        {catalog.error && (
          <p role="alert" className="text-sm text-destructive">
            {catalog.error.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
          {list.map((p, i) => (
            <Reveal key={p.slug} delay={i * 70}>
              <ProductCard product={p} />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
