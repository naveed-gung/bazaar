import { createFileRoute, Link } from "@tanstack/react-router";
import { TicketPercent } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
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
      {/* 01 — Deals header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Deals" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Deals</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Deals & Offers</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Reduced prices, same catalogue standards. Every deal below is live right now.
          </p>
        </div>
      </section>

      {/* 02 — Live reductions */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Live Now</span>

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
            icon={<TicketPercent className="h-6 w-6" />}
            title="No live deals right now"
            copy="Price drops rotate weekly. Browse the full catalog in the meantime — new arrivals land first."
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
                reduced {list.length === 1 ? "product" : "products"} live now
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
