import { createFileRoute, Link } from "@tanstack/react-router";
import { TicketPercent } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
import { fromApiProduct, useCatalogProducts } from "@/lib/api";

export const Route = createFileRoute("/deals")({
  head: () => ({
    meta: [
      { title: "Deals & Offers — Bazaar" },
      {
        name: "description",
        content:
          "Live Bazaar deals across audio, computing and smart home — reduced prices on the gear we stand behind.",
      },
      { property: "og:title", content: "Deals & Offers — Bazaar" },
      { property: "og:description", content: "Current price drops on Bazaar technology." },
    ],
  }),
  component: Deals,
});

function Deals() {
  const catalog = useCatalogProducts({ badge: "Deal" });
  const list = (catalog.data?.items ?? []).map(fromApiProduct);

  return (
    <>
      <PageHero
        eyebrow="Deals"
        title="Deals & Offers"
        copy="Reduced prices, same catalogue standards. Every deal below is live right now."
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
            icon={<TicketPercent className="h-6 w-6" />}
            title="No live deals right now"
            copy="Price drops rotate weekly. Browse the full catalog in the meantime — new arrivals land first."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse all products
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="tabular font-semibold text-foreground">{list.length}</span> reduced{" "}
              {list.length === 1 ? "product" : "products"} live now
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
