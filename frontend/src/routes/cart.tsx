import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShieldCheck, X } from "lucide-react";
import { PageHero } from "@/components/page-hero";
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

function Cart() {
  const { cartLines, subtotal, setQty, removeFromCart, clearCart, pending, error } = useStore();
  const shipping = subtotal > 50 || subtotal === 0 ? 0 : 9;
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
          <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
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
            <Link
              to="/login"
              className="shrink-0 text-sm font-semibold text-glow underline underline-offset-4"
            >
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
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading your cart…
          </p>
        ) : cartLines.length === 0 ? (
          <div>
            <p className="text-lg text-muted-foreground">Your cart is empty.</p>
            <Link
              to="/shop"
              className="mt-8 inline-block rounded-xl bg-signal px-7 py-3.5 text-sm font-semibold text-signal-foreground"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5">
              {cartLines.map(({ product, qty }) => (
                <div
                  key={product.slug}
                  className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-5 rounded-2xl border border-border bg-surface p-5"
                >
                  <img
                    src={product.img}
                    alt={product.name}
                    className="h-[88px] w-[88px] shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0">
                    <Link
                      to="/product/$slug"
                      params={{ slug: product.slug }}
                      className="truncate font-bold hover:text-glow"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">{product.category}</p>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Decrease quantity"
                        onClick={() => setQty(product.slug, qty - 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-6 text-center text-sm">{qty}</span>
                      <button
                        type="button"
                        disabled={pending}
                        aria-label="Increase quantity"
                        onClick={() => setQty(product.slug, qty + 1)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <span className="font-bold">{formatPrice(product.price * qty)}</span>
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={`Remove ${product.name}`}
                      onClick={() => removeFromCart(product.slug)}
                      className="text-muted-foreground hover:text-foreground"
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
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                Clear cart
              </button>
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-surface p-8">
              <h2 className="text-lg font-bold">Order Summary</h2>
              <dl className="mt-6 space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatPrice(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd>{shipping === 0 ? "Free" : formatPrice(shipping)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-4 text-base font-bold">
                  <dt>Total</dt>
                  <dd>{formatPrice(subtotal + shipping)}</dd>
                </div>
              </dl>
              <Link
                to="/checkout"
                className="mt-8 block rounded-xl bg-signal px-6 py-4 text-center text-sm font-semibold text-signal-foreground"
              >
                Proceed to Checkout
              </Link>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
