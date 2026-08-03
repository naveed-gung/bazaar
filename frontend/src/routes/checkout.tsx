import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pill } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Bazaar" },
      {
        name: "description",
        content: "Secure three-step Bazaar checkout using a clearly labeled payment simulator.",
      },
    ],
  }),
  component: Checkout,
});

type Shipping = {
  email: string;
  fullName: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
type Order = { reference: string; state: string; totals: { total: { amountMinor: number } } };
type Money = { amountMinor: number; currency: string };
type CheckoutQuote = {
  id: string;
  expiresAt: string;
  promotion: { code: string; name: string } | null;
  totals: {
    subtotal: Money;
    discount: Money;
    shipping: Money;
    tax: Money;
    total: Money;
  };
};
const initialShipping: Shipping = {
  email: "",
  fullName: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "United States",
};
const steps = ["Shipping", "Payment", "Review"];

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

function Checkout() {
  const { cartLines, subtotal, clearCart } = useStore();
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState(initialShipping);
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [promotionCode, setPromotionCode] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState("");
  const shippingCost = subtotal >= 50 || subtotal === 0 ? 0 : 7.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shippingCost + tax;

  async function prepareReview() {
    setQuoting(true);
    setError("");
    try {
      const result = await api<CheckoutQuote>("/orders/quote", {
        method: "POST",
        body: JSON.stringify({ promotionCode }),
      });
      setQuote(result);
      setStep(2);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The order totals could not be prepared.",
      );
    } finally {
      setQuoting(false);
    }
  }

  async function placeOrder() {
    if (!quote) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api<Order>("/orders/checkout", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ shipping, paymentMethod: "simulator", quoteId: quote.id }),
      });
      setOrder(result);
      clearCart();
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        ["QUOTE_EXPIRED", "RESERVATION_EXPIRED"].includes(caught.code)
      ) {
        setQuote(null);
        setStep(1);
      }
      setError(caught instanceof Error ? caught.message : "Order could not be placed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (order)
    return (
      <>
        <PageHero
          eyebrow="Checkout"
          title="Order confirmed"
          copy="Your order is saved and its reference comes from the Bazaar API."
        />
        <section className="mx-auto max-w-[1600px] px-6 py-20 lg:px-10">
          <div className="panel max-w-xl p-8" role="status">
            <span
              className="grid h-12 w-12 place-items-center rounded-full bg-signal text-signal-foreground"
              aria-hidden="true"
            >
              <Check className="h-6 w-6" />
            </span>
            <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Order reference
            </p>
            <p className="tabular mt-2 text-2xl font-extrabold tracking-tight">{order.reference}</p>
            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <dt className="text-muted-foreground">Total charged</dt>
                <dd className="tabular font-bold">
                  {formatPrice(order.totals.total.amountMinor / 100)}
                </dd>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <dt className="text-muted-foreground">Payment</dt>
                <dd className="font-semibold text-positive">Demo simulator · approved</dd>
              </div>
            </dl>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/account" className="btn btn-primary">
                View order
              </Link>
              <Link to="/shop" className="btn btn-quiet">
                Keep shopping
              </Link>
            </div>
          </div>
        </section>
      </>
    );

  return (
    <>
      <PageHero
        eyebrow="Checkout"
        title="Checkout"
        copy="Shipping, payment simulation, then a final review. No card number is collected."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {/* Numbered circles + connectors: position in the flow stays legible even
            when the labels compress on a narrow viewport. */}
        <ol className="flex max-w-2xl items-center gap-3" aria-label="Checkout progress">
          {steps.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={`flex min-w-0 items-center gap-3 ${
                  index < steps.length - 1 ? "flex-1" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`tabular grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold transition-colors ${
                    done
                      ? "border-signal bg-signal text-signal-foreground"
                      : current
                        ? "border-signal text-glow"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <span
                  className={`truncate text-xs sm:text-sm ${
                    done || current ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {index < steps.length - 1 && (
                  <span
                    aria-hidden="true"
                    className={`h-px min-w-4 flex-1 ${done ? "bg-signal" : "bg-border"}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
        <div className="mt-12 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {step === 0 && (
              <form
                id="shipping-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  setStep(1);
                }}
                className="panel grid gap-5 p-6 sm:grid-cols-2 lg:p-8"
              >
                <div className="sm:col-span-2">
                  <h2 className="text-lg font-bold tracking-tight">Shipping address</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Where the order ships. All fields except apartment are required.
                  </p>
                </div>
                {(
                  [
                    ["email", "Email", "email"],
                    ["fullName", "Full name", "text"],
                    ["address1", "Street address", "text"],
                    ["address2", "Apartment, suite (optional)", "text"],
                    ["city", "City", "text"],
                    ["state", "State", "text"],
                    ["postalCode", "Postal code", "text"],
                    ["country", "Country", "text"],
                  ] as const
                ).map(([name, label, type]) => (
                  <label
                    key={name}
                    className={`block text-sm ${name === "address1" || name === "address2" ? "sm:col-span-2" : ""}`}
                  >
                    <span className="font-medium">
                      {label}
                      {name !== "address2" && (
                        <span className="ml-1 text-destructive" aria-hidden="true">
                          *
                        </span>
                      )}
                    </span>
                    <input
                      required={name !== "address2"}
                      autoComplete={
                        name === "fullName" ? "name" : name === "postalCode" ? "postal-code" : name
                      }
                      inputMode={name === "postalCode" ? "numeric" : undefined}
                      type={type}
                      value={shipping[name]}
                      onChange={(event) =>
                        setShipping((current) => ({ ...current, [name]: event.target.value }))
                      }
                      className={FIELD}
                    />
                  </label>
                ))}
              </form>
            )}
            {step === 1 && (
              <div className="panel p-6 lg:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-background text-glow"
                    aria-hidden="true"
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <Pill tone="signal">Simulation</Pill>
                </div>
                <h2 className="mt-6 text-lg font-bold tracking-tight">Demo payment simulator</h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  No money is charged and no card number, security code, or financial credential is
                  collected. Continuing simulates an approved payment for this staging store.
                </p>
                <label className="mt-6 flex min-h-11 cursor-default items-center gap-3 rounded-xl border border-signal/40 bg-signal/5 px-4 text-sm font-medium">
                  <input
                    required
                    type="radio"
                    checked
                    readOnly
                    name="payment"
                    className="h-4 w-4 accent-signal"
                  />
                  Simulate successful payment
                </label>
                <label className="mt-6 block text-sm">
                  <span className="font-medium">Promotion code</span>
                  <input
                    type="text"
                    value={promotionCode}
                    onChange={(event) => {
                      setPromotionCode(event.target.value.toUpperCase());
                      setQuote(null);
                    }}
                    placeholder="WELCOME10"
                    autoComplete="off"
                    aria-describedby="promotion-help"
                    className={`${FIELD} uppercase tracking-wider`}
                  />
                  <span id="promotion-help" className="field-help">
                    Optional. The server validates the code and applies the discount on the next
                    step.
                  </span>
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-6">
                <div className="panel p-6 lg:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-bold">Deliver to</h2>
                    <button
                      type="button"
                      onClick={() => setStep(0)}
                      className="btn btn-ghost btn-sm -mr-3 text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {shipping.fullName}
                    <br />
                    {shipping.address1}
                    {shipping.address2 ? `, ${shipping.address2}` : ""}
                    <br />
                    {shipping.city}, {shipping.state} {shipping.postalCode}
                    <br />
                    {shipping.country}
                  </p>
                </div>
                <div className="panel p-6 lg:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="font-bold">Payment</h2>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="btn btn-ghost btn-sm -mr-3 text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Demo simulator · successful result
                  </p>
                  {quote?.promotion && (
                    <p className="mt-2 text-sm font-semibold text-signal">
                      {quote.promotion.code} applied · {quote.promotion.name}
                    </p>
                  )}
                  {quote && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Stock and totals reserved until{" "}
                      {new Date(quote.expiresAt).toLocaleTimeString()}.
                    </p>
                  )}
                </div>
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm leading-relaxed text-destructive"
              >
                {error}
              </p>
            )}
            {!cartLines.length && (
              <p className="mt-6 rounded-xl border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                Your cart is empty, so there is nothing to check out.{" "}
                <Link to="/shop" className="font-semibold text-glow hover:underline">
                  Browse the catalog
                </Link>
                .
              </p>
            )}
            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                disabled={step === 0 || submitting || quoting}
                onClick={() => {
                  setError("");
                  setStep((current) => current - 1);
                }}
                className="btn btn-quiet"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < 2 ? (
                <button
                  type={step === 0 ? "submit" : "button"}
                  form={step === 0 ? "shipping-form" : undefined}
                  disabled={quoting || !cartLines.length}
                  onClick={step === 1 ? prepareReview : undefined}
                  className="btn btn-primary btn-lg"
                >
                  {quoting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {quoting ? "Reserving stock…" : "Continue"}
                  {!quoting && <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!cartLines.length || submitting || !quote}
                  onClick={placeOrder}
                  className="btn btn-primary btn-lg"
                >
                  {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {submitting ? (
                    "Placing order…"
                  ) : (
                    <>
                      Place order
                      <span aria-hidden="true">·</span>
                      <span className="tabular">
                        {formatPrice((quote?.totals.total.amountMinor ?? total * 100) / 100)}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          <aside className="panel h-fit p-6 lg:sticky lg:top-28 lg:p-8">
            <h2 className="text-lg font-bold tracking-tight">Order summary</h2>
            <ul className="mt-6 space-y-4">
              {cartLines.map(({ product, qty }) => (
                <li key={product.slug} className="flex items-center gap-4">
                  <img
                    src={product.img}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-xl border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{product.name}</p>
                    <p className="tabular mt-0.5 text-xs text-muted-foreground">
                      {formatPrice(product.price)} × {qty}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-sm font-semibold">
                    {formatPrice(product.price * qty)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-3.5 border-t border-border pt-5 text-sm">
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular font-medium">
                  {formatPrice((quote?.totals.subtotal.amountMinor ?? subtotal * 100) / 100)}
                </dd>
              </div>
              {Boolean(quote?.totals.discount.amountMinor) && (
                <div className="grid grid-cols-[1fr_auto] gap-6 text-positive">
                  <dt className="font-medium">Promotion</dt>
                  <dd className="tabular font-semibold">
                    −{formatPrice((quote?.totals.discount.amountMinor ?? 0) / 100)}
                  </dd>
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd
                  className={
                    (quote?.totals.shipping.amountMinor ?? shippingCost * 100)
                      ? "tabular font-medium"
                      : "font-semibold text-positive"
                  }
                >
                  {(quote?.totals.shipping.amountMinor ?? shippingCost * 100)
                    ? formatPrice((quote?.totals.shipping.amountMinor ?? shippingCost * 100) / 100)
                    : "Free"}
                </dd>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-6">
                <dt className="text-muted-foreground">{quote ? "Tax" : "Estimated tax"}</dt>
                <dd className="tabular font-medium">
                  {formatPrice((quote?.totals.tax.amountMinor ?? tax * 100) / 100)}
                </dd>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-6 border-t border-border pt-4 text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular">
                  {formatPrice((quote?.totals.total.amountMinor ?? total * 100) / 100)}
                </dd>
              </div>
            </dl>
            <p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-glow" aria-hidden="true" />
              {quote
                ? "These are the server-confirmed totals held by your reservation."
                : "Totals shown are estimates until the server prepares your order on the review step."}
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
