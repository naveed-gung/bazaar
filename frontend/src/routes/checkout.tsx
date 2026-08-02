import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/page-hero";
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
          <div className="max-w-xl rounded-2xl border border-border bg-surface p-8" role="status">
            <Check className="h-10 w-10 rounded-full bg-signal p-2 text-signal-foreground" />
            <p className="mt-6 text-sm text-muted-foreground">Order reference</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{order.reference}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Total {formatPrice(order.totals.total.amountMinor / 100)} · Demo payment confirmed
            </p>
            <Link
              to="/account"
              className="mt-8 inline-flex min-h-11 items-center rounded-xl bg-signal px-7 text-sm font-semibold text-signal-foreground"
            >
              View order
            </Link>
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
        <ol className="grid max-w-2xl grid-cols-3 gap-2" aria-label="Checkout progress">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? "step" : undefined}
              className={`border-t-2 pt-3 text-sm ${index <= step ? "border-signal font-semibold text-foreground" : "border-border text-muted-foreground"}`}
            >
              {index + 1}. {label}
            </li>
          ))}
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
                className="grid gap-5 sm:grid-cols-2"
              >
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
                    className={`text-sm ${name === "address1" || name === "address2" ? "sm:col-span-2" : ""}`}
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <input
                      required={name !== "address2"}
                      autoComplete={
                        name === "fullName" ? "name" : name === "postalCode" ? "postal-code" : name
                      }
                      type={type}
                      value={shipping[name]}
                      onChange={(event) =>
                        setShipping((current) => ({ ...current, [name]: event.target.value }))
                      }
                      className="mt-2 min-h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm outline-none focus:border-signal"
                    />
                  </label>
                ))}
              </form>
            )}
            {step === 1 && (
              <div className="rounded-2xl border border-border bg-surface p-8">
                <ShieldCheck className="h-10 w-10 text-glow" />
                <h2 className="mt-5 text-xl font-bold">Demo payment simulator</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                  No money is charged and no card number, security code, or financial credential is
                  collected. Continuing simulates an approved payment for this staging store.
                </p>
                <label className="mt-6 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-background px-4 text-sm">
                  <input required type="radio" checked readOnly name="payment" /> Simulate
                  successful payment
                </label>
                <label className="mt-6 block text-sm">
                  <span className="text-muted-foreground">Promotion code (optional)</span>
                  <input
                    type="text"
                    value={promotionCode}
                    onChange={(event) => {
                      setPromotionCode(event.target.value.toUpperCase());
                      setQuote(null);
                    }}
                    placeholder="WELCOME10"
                    autoComplete="off"
                    className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 uppercase outline-none focus:border-signal"
                  />
                </label>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-border bg-surface p-7">
                  <h2 className="font-bold">Deliver to</h2>
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
                <div className="rounded-2xl border border-border bg-surface p-7">
                  <h2 className="font-bold">Payment</h2>
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
                className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                {error}
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
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-5 text-sm font-semibold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < 2 ? (
                <button
                  type={step === 0 ? "submit" : "button"}
                  form={step === 0 ? "shipping-form" : undefined}
                  disabled={quoting || !cartLines.length}
                  onClick={step === 1 ? prepareReview : undefined}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground disabled:opacity-40"
                >
                  {quoting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {quoting ? "Reserving stock…" : "Continue"}{" "}
                  {!quoting && <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!cartLines.length || submitting || !quote}
                  onClick={placeOrder}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground disabled:opacity-40"
                >
                  {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {submitting
                    ? "Placing order…"
                    : `Place order · ${formatPrice((quote?.totals.total.amountMinor ?? total * 100) / 100)}`}
                </button>
              )}
            </div>
          </div>
          <aside className="h-fit rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-lg font-bold">Order summary</h2>
            <ul className="mt-6 space-y-4 text-sm">
              {cartLines.map(({ product, qty }) => (
                <li key={product.slug} className="flex justify-between gap-4">
                  <span className="min-w-0 truncate text-muted-foreground">
                    {product.name} × {qty}
                  </span>
                  <span>{formatPrice(product.price * qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatPrice((quote?.totals.subtotal.amountMinor ?? subtotal * 100) / 100)}</dd>
              </div>
              {Boolean(quote?.totals.discount.amountMinor) && (
                <div className="flex justify-between text-signal">
                  <dt>Promotion</dt>
                  <dd>−{formatPrice((quote?.totals.discount.amountMinor ?? 0) / 100)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>
                  {(quote?.totals.shipping.amountMinor ?? shippingCost * 100)
                    ? formatPrice((quote?.totals.shipping.amountMinor ?? shippingCost * 100) / 100)
                    : "Free"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{quote ? "Tax" : "Estimated tax"}</dt>
                <dd>{formatPrice((quote?.totals.tax.amountMinor ?? tax * 100) / 100)}</dd>
              </div>
              <div className="flex justify-between pt-2 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatPrice((quote?.totals.total.amountMinor ?? total * 100) / 100)}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </>
  );
}
