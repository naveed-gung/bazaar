import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, ShoppingBag, Tag, Truck } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { confirmDialog } from "@/components/confirm-dialog";
import { CartLineRow } from "@/components/cart-drawer";
import { EmptyState, Skeleton } from "@/components/ui";
import { showToast } from "@/components/toast";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";
import { api, ApiError, useAuthStatus } from "@/lib/api";

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

type QuotePreview = {
  promotion: { code: string; name: string } | null;
  totals: { discount: { amountMinor: number }; total: { amountMinor: number } };
};

/** SSR-38 — response of the PUBLIC POST /orders/promotions/validate endpoint. */
type PromotionValidation = {
  valid: boolean;
  code: string;
  name: string;
  kind: string;
  value: number;
};

const PROMO_KEY = "bazaar.promo";

function Cart() {
  const {
    cartDetail,
    cartLines,
    subtotal,
    cartReady,
    setQty,
    removeFromCart,
    clearCart,
    saveForLater,
    moveSavedToCart,
    removeSaved,
    saved,
    pending,
    error,
  } = useStore();
  const auth = useAuthStatus();

  // Promo feedback is server-authoritative and USER-TRIGGERED ONLY — the mutation fires
  // exclusively from applyPromo() (Apply button / Enter); nothing re-validates on mount or
  // render, so there is no load-time request loop. SSR-38: guests keep their cart locally
  // (SSR-35) and have no server cart, so their codes validate against the PUBLIC
  // /orders/promotions/validate endpoint instead of POST /orders/quote (which would fail
  // with EMPTY_CART and never reach the promotion lookup). Accepted codes persist through
  // the existing sessionStorage flow and are re-validated server-side at checkout.
  // Signed-in shoppers keep the quote-based path byte-for-byte: accepted codes return the
  // active promotion + discounted totals; unknown codes come back as PROMOTION_INVALID.
  // Hydration-safe (SSR-14, mirrors the SSR-11 checkout fix): sessionStorage is
  // read after mount, so the server and the first client render agree on "".
  const [promoInput, setPromoInput] = useState("");
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    setPromoInput(sessionStorage.getItem(PROMO_KEY) ?? "");
  }, []);
  const authenticated = auth.data?.authenticated === true;
  const [promo, setPromo] = useState<
    | { status: "applied"; code: string; name: string; discountMinor?: number }
    | { status: "rejected"; message: string }
    | null
  >(null);
  const promoCheck = useMutation({
    mutationFn: async (code: string) => {
      if (!authenticated) {
        // Guest path — no cart required, no session required.
        return api<PromotionValidation>("/orders/promotions/validate", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      }
      return api<QuotePreview>("/orders/quote", {
        method: "POST",
        body: JSON.stringify(code ? { promotionCode: code } : {}),
      });
    },
    onSuccess: (result) => {
      if ("valid" in result) {
        // Guest validation has no totals to preview (no server cart exists) — the
        // discount amount surfaces at checkout, exactly as the field copy says.
        setPromo({ status: "applied", code: result.code, name: result.name });
        showToast("success", `Promotion ${result.code} applied`, result.name);
        return;
      }
      const applied = result.promotion;
      if (applied) {
        setPromo({
          status: "applied",
          code: applied.code,
          name: applied.name,
          discountMinor: result.totals.discount.amountMinor,
        });
        showToast("success", `Promotion ${applied.code} applied`, applied.name);
      } else {
        setPromo(null);
        showToast(
          "info",
          "No promotion on this cart",
          "Add a code and apply it to see the discount.",
        );
      }
    },
    onError: (caught) => {
      setPromo({
        status: "rejected",
        message:
          caught instanceof ApiError && caught.code === "PROMOTION_INVALID"
            ? "That code is invalid or expired."
            : caught instanceof Error
              ? caught.message
              : "The code could not be validated.",
      });
    },
  });

  function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    setPromoInput(code);
    try {
      sessionStorage.setItem(PROMO_KEY, code);
    } catch {
      /* private mode — checkout re-asks for the code */
    }
    promoCheck.mutate(code);
  }

  // SSR-36 — the destructive bulk action runs behind the shared two-step
  // ConfirmDialog; four async branches elsewhere are untouched.
  async function confirmClear() {
    const ok = await confirmDialog({
      title: "Clear the cart?",
      body: "Every line will be removed. This cannot be undone.",
      confirmLabel: "Clear cart",
      destructive: true,
    });
    if (ok) clearCart();
  }

  const toFreeShipping = Math.max(0, 50 - subtotal);
  const shippingProgress = Math.min(100, (subtotal / 50) * 100);

  return (
    <>
      {/* 01 — Cart header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Cart" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Cart</span>
            <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">Your Cart</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Everything you've picked out, in one place. Every amount is recalculated by the server
            when you check out — this page never guesses totals.
          </p>
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        {!auth.isPending && !auth.data?.authenticated && (
          <div className="panel mb-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
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
            className="mb-10 border-l-2 border-destructive bg-surface-2 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!cartReady || (pending && cartLines.length === 0) ? (
          <div
            className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="space-y-5 lg:col-span-8">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
            <Skeleton className="h-96 w-full lg:col-span-4" />
          </div>
        ) : cartLines.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag className="h-6 w-6" />}
            title="Your cart is empty"
            copy="Browse the catalog and add something worth keeping. Your cart survives a page refresh."
            action={
              <Link to="/shop" className="btn btn-primary">
                Start shopping
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            }
          />
        ) : (
          <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            {/* 02 — Items (asymmetric 8/4 split, summary sticks on desktop) */}
            <div className="space-y-8 lg:col-span-8">
              <div>
                <div className="rule-strong" />
                <span className="eyebrow mt-6">02 — Items</span>
              </div>

              {subtotal > 0 && subtotal < 50 && (
                <div className="border border-border bg-surface p-5">
                  <p className="flex items-center gap-2.5 text-sm">
                    <Truck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>
                      Add{" "}
                      <span className="price tabular font-bold">{formatPrice(toFreeShipping)}</span>{" "}
                      more for free standard shipping.
                    </span>
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(shippingProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Progress toward free shipping"
                    className="mt-4 h-1.5 overflow-hidden bg-surface-2"
                  >
                    <span
                      className="block h-full bg-accent transition-[width] duration-700 [transition-timing-function:var(--ease-enter)]"
                      style={{ width: `${shippingProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* The same line component the mini-cart drawer renders. Variant
                  options, stock-clamped steppers and the "Limited to N per
                  order" explanation all come from CartLineRow. */}
              <div aria-live="polite" className="space-y-5">
                {cartDetail.map((line) => (
                  <CartLineRow
                    key={line.lineId}
                    line={line}
                    maxQty={line.stock}
                    pending={pending}
                    onQty={(lineId, qty) =>
                      qty <= 0
                        ? removeFromCart(bySlug(lineId, cartDetail))
                        : setQty(bySlug(lineId, cartDetail), qty)
                    }
                    onRemove={(lineId) => removeFromCart(bySlug(lineId, cartDetail))}
                    onSaveForLater={saveForLater}
                  />
                ))}
              </div>

              {saved.length > 0 && (
                <section aria-labelledby="saved-for-later-heading">
                  <div className="rule-strong" />
                  <h2 id="saved-for-later-heading" className="eyebrow mt-6">
                    Saved for later
                  </h2>
                  <ul className="mt-2">
                    {saved.map((item) => (
                      <li
                        key={item.slug}
                        className="flex flex-col gap-4 border-b border-border py-5 sm:flex-row sm:items-center"
                      >
                        <img
                          src={item.img}
                          alt=""
                          width={56}
                          height={56}
                          loading="lazy"
                          className="h-14 w-14 shrink-0 border border-border object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/product/$slug"
                            params={{ slug: item.slug }}
                            className="block truncate text-sm font-semibold hover:text-accent"
                          >
                            {item.name}
                          </Link>
                          <p className="price tabular mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(item.price)} · qty {item.qty}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => moveSavedToCart(item.slug)}
                            className="btn btn-quiet btn-sm"
                          >
                            Move to cart
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSaved(item.slug)}
                            aria-label={`Remove ${item.name} from saved items`}
                            className="btn btn-ghost btn-sm text-muted-foreground hover:text-destructive"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* 03 — Summary */}
            <aside className="panel lg:sticky lg:top-28 lg:col-span-4">
              <div className="p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="eyebrow">03 — Summary</span>
                    <h2 className="font-display mt-4 text-lg font-bold tracking-tight">
                      Order summary
                    </h2>
                  </div>
                  {/* SSR-36 — Clear cart lives beside the subtotal header and is
                      confirmed (it replaced the bare unconfirmed ghost button
                      that sat below the line rows). */}
                  <button
                    type="button"
                    onClick={() => void confirmClear()}
                    disabled={pending}
                    aria-label="Clear every item from the cart"
                    className="btn btn-ghost btn-sm -mr-3 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    Clear cart
                  </button>
                </div>

                <div className="mt-6">
                  <label htmlFor="cart-promo" className="text-sm font-medium">
                    Promotion code
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="cart-promo"
                      type="text"
                      value={promoInput}
                      onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyPromo();
                        }
                      }}
                      placeholder="WELCOME10"
                      autoComplete="off"
                      aria-invalid={promo?.status === "rejected" ? "true" : undefined}
                      aria-describedby="cart-promo-status"
                      className="field uppercase tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={applyPromo}
                      disabled={promoCheck.isPending || !promoInput.trim()}
                      className="btn btn-quiet shrink-0"
                    >
                      {promoCheck.isPending ? "Checking…" : "Apply"}
                    </button>
                  </div>
                  <p
                    id="cart-promo-status"
                    aria-live="polite"
                    className={
                      promo?.status === "rejected"
                        ? "field-error"
                        : promo?.status === "applied"
                          ? "field-help font-semibold text-positive"
                          : "field-help"
                    }
                  >
                    {promo?.status === "applied"
                      ? `${promo.code} — ${promo.name}. Discount shows at checkout.`
                      : promo?.status === "rejected"
                        ? promo.message
                        : "Validated by the server against active promotions."}
                  </p>
                </div>

                <dl className="mt-6 space-y-4 border-t border-border pt-5 text-sm">
                  <div className="grid grid-cols-[1fr_auto] items-baseline gap-6">
                    <dt className="text-muted-foreground">
                      Subtotal
                      <span className="tabular ml-1.5 text-xs">
                        ({cartLines.length} {cartLines.length === 1 ? "item" : "items"})
                      </span>
                    </dt>
                    <dd className="price tabular text-right text-3xl leading-none font-bold">
                      {formatPrice(subtotal)}
                    </dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-6">
                    <dt className="text-muted-foreground">Shipping & tax</dt>
                    <dd className="text-right text-muted-foreground">Quoted at checkout</dd>
                  </div>
                </dl>
                <p className="mt-4 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <Tag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                  Every amount is recalculated by the server when you check out — this page never
                  guesses totals.
                </p>
                <Link to="/checkout" className="btn btn-primary btn-lg mt-6 w-full">
                  Proceed to checkout
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}

/** Cart rows are keyed by lineId (=variantId); actions speak in slugs. */
function bySlug(lineId: string, lines: { lineId: string; slug: string }[]) {
  return lines.find((line) => line.lineId === lineId)?.slug ?? "";
}
