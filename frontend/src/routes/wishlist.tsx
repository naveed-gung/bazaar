import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { fromApiProduct, useCatalogProducts } from "@/lib/api";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Wishlist — Bazaar" },
      { name: "description", content: "Products saved to your server-backed Bazaar wishlist." },
      { property: "og:title", content: "Wishlist — Bazaar" },
      { property: "og:description", content: "Your saved Bazaar products." },
    ],
  }),
  component: Wishlist,
});

function Wishlist() {
  const { wishlist } = useStore();
  const catalog = useCatalogProducts();
  const list = (catalog.data?.items ?? [])
    .filter((p) => wishlist.includes(p.slug))
    .map(fromApiProduct);

  return (
    <>
      <PageHero
        eyebrow="Wishlist"
        title="Saved Items"
        copy="Saved to your Bazaar guest or account identity, ready when you are."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {catalog.isPending ? (
          <p className="text-sm text-muted-foreground">Loading saved items…</p>
        ) : list.length === 0 ? (
          <div>
            <p className="text-lg text-muted-foreground">You haven't saved anything yet.</p>
            <Link
              to="/shop"
              className="mt-8 inline-block rounded-xl bg-signal px-7 py-3.5 text-sm font-semibold text-signal-foreground"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
            {list.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
