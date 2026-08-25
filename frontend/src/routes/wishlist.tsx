import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, ShoppingBag } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { confirmDialog } from "@/components/confirm-dialog";
import { AvailabilityTag, EmptyState, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/products";
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
  const { wishlist, addToCart, toggleWishlist } = useStore();
  const catalog = useCatalogProducts();
  const list = (catalog.data?.items ?? [])
    .filter((p) => wishlist.includes(p.slug))
    .map(fromApiProduct);

  // SSR-36 — bulk removal runs behind the shared two-step ConfirmDialog; the
  // existing optimistic toggle mutation does the per-slug work unchanged.
  async function removeAllSaved() {
    const ok = await confirmDialog({
      title: "Remove all saved items?",
      body: `All ${list.length} saved ${list.length === 1 ? "item" : "items"} will be removed from your wishlist.`,
      confirmLabel: "Remove all",
      destructive: true,
    });
    if (!ok) return;
    for (const p of list) toggleWishlist(p.slug);
  }

  return (
    <>
      {/* 01 — Saved header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Wishlist" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Saved</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Saved Items</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Saved to your Bazaar guest or account identity, ready when you are.
          </p>
        </div>
      </section>

      {/* 02 — Ruled line-item rows */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Your List</span>

        {catalog.isPending ? (
          <div className="mt-10 space-y-6" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-6 border-b border-border pb-6">
                <Skeleton className="h-24 w-24 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-5 w-56 max-w-full" />
                  <Skeleton className="mt-3 h-3 w-32" />
                </div>
                <Skeleton className="hidden h-6 w-24 shrink-0 sm:block" />
                <Skeleton className="hidden h-12 w-40 shrink-0 sm:block" />
              </div>
            ))}
          </div>
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
            className="mt-8"
          />
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              <p className="flex items-baseline gap-3" aria-live="polite">
                <span className="price tabular text-5xl leading-none font-bold">{list.length}</span>
                <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  saved {list.length === 1 ? "item" : "items"}
                </span>
              </p>
              {/* SSR-36 — bulk action beside the count header, confirmed. */}
              <button
                type="button"
                onClick={() => void removeAllSaved()}
                aria-label={`Remove all ${list.length} saved items from your wishlist`}
                className="btn btn-ghost btn-sm shrink-0 text-muted-foreground hover:text-destructive"
              >
                Remove all
              </button>
            </div>
            <ul className="mt-10 border-t border-border">
              {list.map((p, index) => {
                const dropped = p.was !== undefined && p.was > p.price;
                const dropPct =
                  dropped && p.was !== undefined
                    ? Math.round(((p.was - p.price) / p.was) * 100)
                    : 0;
                return (
                  <li key={p.slug} className="border-b border-border py-6">
                    <article className="flex flex-col gap-6 sm:flex-row sm:items-center">
                      <span className="tabular hidden w-8 shrink-0 text-xs font-bold text-muted-foreground sm:block">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Link
                        to="/product/$slug"
                        params={{ slug: p.slug }}
                        className="block shrink-0 border border-border"
                      >
                        <img
                          src={p.img}
                          alt=""
                          width={96}
                          height={96}
                          loading="lazy"
                          className="h-24 w-24 object-cover"
                        />
                      </Link>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                          {p.brand}
                        </p>
                        <h3 className="font-display mt-1 text-lg font-bold tracking-tight">
                          <Link
                            to="/product/$slug"
                            params={{ slug: p.slug }}
                            className="transition-colors hover:text-accent"
                          >
                            {p.name}
                          </Link>
                        </h3>
                        <AvailabilityTag availability={p.availability} className="mt-2" />
                      </div>
                      <div className="shrink-0 sm:text-right">
                        <p className="price tabular text-xl font-bold">{formatPrice(p.price)}</p>
                        {p.was !== undefined && (
                          <p className="tabular mt-1 text-xs text-muted-foreground line-through">
                            {formatPrice(p.was)}
                          </p>
                        )}
                        {dropped && (
                          <span className="pill mt-2 border-accent bg-accent text-accent-foreground">
                            Price drop −{dropPct}%
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => addToCart(p.slug)}
                          disabled={p.availability === "out_of_stock"}
                          className="btn btn-quiet"
                        >
                          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                          Move to cart
                        </button>
                        {/* SSR-36 — labelled per-item remove; the same toggle
                            mutation the heart uses, now visible on the row. */}
                        <button
                          type="button"
                          onClick={() => toggleWishlist(p.slug)}
                          aria-label={`Remove ${p.name} from your saved items`}
                          className="btn btn-ghost btn-sm text-muted-foreground hover:text-destructive"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
