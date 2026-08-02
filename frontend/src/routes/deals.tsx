import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
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
        {catalog.isPending && <p className="text-sm text-muted-foreground">Loading deals…</p>}
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
