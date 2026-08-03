import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
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
          <ProductGridSkeleton count={4} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="Nothing saved yet"
            copy="Tap the heart on any product to keep it here. Saved items follow your guest session and merge into your account when you sign in."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse products
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="tabular font-semibold text-foreground">{list.length}</span> saved{" "}
              {list.length === 1 ? "item" : "items"}
            </p>
            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
              {list.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
