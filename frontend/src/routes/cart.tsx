import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Minus, Plus, ShieldCheck, ShoppingBag, Truck, X } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { EmptyState, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";
import { useAuthStatus } from "@/lib/api";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Bazaar" },
      {
        name: "description",
        content: "Review the items in your Bazaar cart and continue to checkout.",
      },
      { property: "og:title", content: "Your Cart — Bazaar" },
      { property: "og:description", content: "Review your Bazaar cart." },
    ],
  }),
  component: Cart,
});

/** Mirrors backend/src/domain/checkout.ts — free at $50, otherwise $7.99, tax 8%. */
const FREE_SHIPPING_AT = 50;
const FLAT_SHIPPING = 7.99;
const TAX_RATE = 0.08;

function Cart() {
  const { cartLines, subtotal, setQty, removeFromCart, clearCart, pending, error } = useStore();
  const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_AT ? 0 : FLAT_SHIPPING;
  const tax = subtotal * TAX_RATE;
  const toFreeShipping = Math.max(0, FREE_SHIPPING_AT - subtotal);
  const shippingProgress = Math.min(100, (subtotal / FREE_SHIPPING_AT) * 100);
  const auth = useAuthStatus();

  return (
    <>
      <PageHero
        eyebrow="Cart"
        title="Your Cart"
        copy="Everything you've picked out, in one place."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {!auth.isPending && !auth.data?.authenticated && (
          <div className="panel mb-8 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-glow" aria-hidden="true" />
              <div>
                <p className="font-semibold">Guest checkout is ready</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  No account is required. This cart stays with this browser, and signing in later
                  safely merges your cart, favorites, and comparison list.
                </p>
              </div>
            </div>
            <Link to="/login" className="btn btn-quiet btn-sm shrink-0">
              Sign in optionally
            </Link>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mb-8 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {pending && cartLines.length === 0 ? (
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]" aria-busy="true" aria-live="polite">
            <div className="space-y-5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : cartLines.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your cart is empty"
            copy="Browse the catalog and add something worth keeping. Your cart survives a page refresh."
            action={
              <Link to="/shop" className="btn btn-primary">
                Start shopping
              </Link>
            }
          />
        ) : (
          <div className="grid items-start gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              {shipping > 0 && (
                <div className="panel p-5">
                  <p className="flex items-center gap-2.5 text-sm">
                    <Truck className="h-4 w-4 shrink-0 text-glow" aria-hidden="true" />
                    <span>
                      Add <span className="tabular font-bold">{formatPrice(toFreeShipping)}</span>{" "}
                      more for free shipping.
                    </span>
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(shippingProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progress toward free shipping"
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2"
                  >
                    <span
                      className="block h-full rounded-full bg-signal transition-[width] duration-500"
                      style={{ width: `${shippingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {cartLines.map(({ product, qty }) => (
                <div
                  key={product.slug}
                  className="panel grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-5 p-5"
                >
                  <Link to="/product/$slug" params={{ slug: product.slug }} className="shrink-0">
                    <img
                      src={product.img}
                      alt={product.name}
                      width={88}
                      height={88}
                      className="h-22 w-22 rounded-xl border border-border object-cover"
                    />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to="/product/$slug"
                      params={{ slug: product.slug }}
                      className="block truncate font-bold hover:text-glow"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {product.brand} · {product.category}
                    </p>
                    <p className="tabular mt-1 text-xs text-muted-foreground">
                      {formatPrice(product.price)} each
                    </p>
                    <div className="mt-3 flex items-center gap-1 rounded-xl border border-border p-1 w-fit">
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Decrease ${product.name} quantity`}
                        onClick={() => setQty(product.slug, qty - 1)}
                        className="btn btn-ghost btn-icon btn-sm text-muted-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="tabular w-8 text-center text-sm font-semibold">{qty}</span>
                      <button
                        type="button"
                        disabled={pending}
                        aria-label={`Increase ${product.name} quantity`}
                        onClick={() => setQty(product.slug, qty + 1)}
                        className="btn btn-ghost btn-icon btn-sm text-muted-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="tabular font-bold">{formatPrice(product.price * qty)}</span>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${product.name}`}
                      onClick={() => removeFromCart(product.slug)}
                      className="btn btn-ghost btn-icon btn-sm text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                disabled={pending}
                onClick={clearCart}
                className="btn btn-ghost btn-sm -ml-3.5 text-muted-foreground hover:text-destructive"
              >
                Clear cart
              </button>
            </div>

            <aside className="panel p-8 lg:sticky lg:top-28">
              <h2 className="text-lg font-bold">Order summary</h2>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="grid grid-cols-[1fr_auto] gap-6">
                  <dt className="text-muted-foreground">
                    Subtotal
                    <span className="tabular ml-1.5 text-xs">
                      ({cartLines.length} {cartLines.length === 1 ? "item" : "items"})
                    </span>
                  </dt>
                  <dd className="tabular font-medium">{formatPrice(subtotal)}</dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-6">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className={shipping === 0 ? "font-semibold text-positive" : "tabular"}>
                    {shipping === 0 ? "Free" : formatPrice(shipping)}
                  </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-6">
                  <dt className="text-muted-foreground">Estimated tax (8%)</dt>
                  <dd className="tabular">{formatPrice(tax)}</dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-6 border-t border-border pt-4 text-base font-bold">
                  <dt>Estimated total</dt>
                  <dd className="tabular">{formatPrice(subtotal + shipping + tax)}</dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                The server recalculates every amount at checkout. Promotions are applied there.
              </p>
              <Link to="/checkout" className="btn btn-primary btn-lg mt-6 w-full">
                Proceed to checkout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
