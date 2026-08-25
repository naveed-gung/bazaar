import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Clock, LoaderCircle, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { api, ApiError, useAuthStatus, useSavedAddresses, useShippingMethods } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Bazaar" },
      {
        name: "description",
        content: "Secure three-step Bazaar checkout with encrypted payment and a final review.",
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
  shippingMethod?: { code: string; name: string; description: string };
  totals: {
    subtotal: Money;
    discount: Money;
    /** SSR-20: additive server-driven welcome-offer line; present only when applied. */
    welcomeDiscount?: Money;
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

const FIELD_DEFS = [
  ["email", "Email", "email"],
  ["fullName", "Full name", "text"],
  ["address1", "Street address", "text"],
  ["address2", "Apartment, suite (optional)", "text"],
  ["city", "City", "text"],
  ["state", "State", "text"],
  ["postalCode", "Postal code", "text"],
  ["country", "Country", "text"],
] as const;

type FieldName = (typeof FIELD_DEFS)[number][0];

function validateField(name: FieldName, value: string): string {
  const trimmed = value.trim();
  if (name === "address2") return "";
  if (!trimmed) return "This field is required.";
  if (name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
    return "Enter a valid email address.";
  if (name === "postalCode" && trimmed.length > 32) return "Keep it under 32 characters.";
  return "";
}

function validateAll(shipping: Shipping): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  for (const [name] of FIELD_DEFS) {
    const message = validateField(name, shipping[name]);
    if (message) errors[name] = message;
  }
  return errors;
}

/** Square radio card — selected state is the accent hairline + tint, never a pill. */
const RADIO_CARD = (selected: boolean) =>
  `flex min-h-11 cursor-pointer items-center border px-4 py-3 text-sm transition-colors ${
    selected ? "border-accent bg-accent/5" : "border-border hover:border-foreground"
  }`;

function Checkout() {
  // SSR-35 — cartReady gates the whole page: it stays false until the auth
  // probe has settled AND the localStorage snapshot has loaded, so neither
  // the wizard nor the sign-in gate can decide on unknown state.
  const { cartDetail, cartLines, subtotal, clearCart, cartCount, cartReady } = useStore();
  const auth = useAuthStatus();
  const addresses = useSavedAddresses(Boolean(auth.data?.authenticated));
  const methods = useShippingMethods();
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState(initialShipping);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const fieldRefs = useRef(new Map<FieldName, HTMLInputElement>());
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [usingNewAddress, setUsingNewAddress] = useState(false);
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [order, setOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [quoting, setQuoting] = useState(false);
  // Hydration-safe (SSR-11 sweep): sessionStorage is read after mount, so the
  // server and the first client render agree on "".
  const [promotionCode, setPromotionCode] = useState("");
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const [error, setError] = useState("");
  // Estimates only — the server quote is authoritative once it exists.
  const estimateShipping = subtotal >= 50 || subtotal === 0 ? 0 : 7.99;
  const estimateTax = subtotal * 0.08;

  // SSR-35 — HARD GATE (owner-approved): guests cannot quote against nothing.
  // When the cart is non-empty and still local (unauthenticated), the wizard
  // is replaced by a sign-in/sign-up panel. ?redirect=/checkout semantics are
  // preserved by the links below, so login returns here and the store's
  // merge-on-authentication completes the handoff automatically. Signed-in
  // shoppers never see any of this; their flow below is byte-for-byte intact.
  const guestMustSignIn = cartReady && !auth.data?.authenticated && Boolean(cartLines.length);
  const gateHeld = !cartReady;

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    setPromotionCode(sessionStorage.getItem("bazaar.promo") ?? "");
  }, []);

  function applyAddress(id: string) {
    const address = addresses.data?.find((entry) => entry.id === id);
    if (!address) return;
    setSelectedAddressId(id);
    setShipping((current) => ({
      ...current,
      fullName: address.fullName,
      address1: address.address1,
      address2: address.address2 ?? "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
    }));
    setErrors({});
  }

  async function prepareReview() {
    setQuoting(true);
    setError("");
    try {
      const result = await api<CheckoutQuote>("/orders/quote", {
        method: "POST",
        body: JSON.stringify({
          ...(promotionCode.trim() ? { promotionCode: promotionCode.trim() } : {}),
          shippingMethod,
        }),
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
        {/* Confirmation header */}
        <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
          <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Checkout" }]} />
          <div className="rule-strong mt-8" />
          <span className="eyebrow mt-6">Checkout</span>
          <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">Order Confirmed</h1>
        </section>
        <section className="shell pb-20 lg:pb-28">
          <div className="panel max-w-xl">
            <div className="p-8" role="status">
              <span
                className="grid h-12 w-12 place-items-center bg-accent text-accent-foreground"
                aria-hidden="true"
              >
                <Check className="h-6 w-6" />
              </span>
              <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Order reference
              </p>
              <p className="price tabular mt-2 text-3xl font-bold tracking-tight">
                {order.reference}
              </p>
              <dl className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-6">
                  <dt className="text-muted-foreground">Total charged</dt>
                  <dd className="price tabular text-right text-2xl font-bold">
                    {formatPrice(order.totals.total.amountMinor / 100)}
                  </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-6">
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd className="text-right font-semibold text-positive">Confirmed</dd>
                </div>
              </dl>
              <p className="mt-4 flex gap-2 border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                Checkout is encrypted end to end.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/account" className="btn btn-primary">
                  View order
                </Link>
                <Link to="/shop" className="btn btn-quiet">
                  Keep shopping
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );

  return (
    <>
      {/* 01 — Checkout header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Checkout" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Checkout</span>
            <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">Checkout</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Shipping, payment, then a final review. Checkout is encrypted end to end.
          </p>
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        {/* SSR-35 — while the cart source is unknown (auth probe + local
            snapshot load) hold a neutral skeleton instead of flashing either
            the wizard or the gate. */}
        {gateHeld ? (
          <div
            className="panel mt-12 h-72 max-w-xl animate-pulse"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="sr-only">Preparing checkout…</span>
          </div>
        ) : guestMustSignIn ? (
          <div className="mx-auto mt-12 w-full max-w-xl">
            <div className="rule-strong" />
            <div className="panel mt-10 p-8">
              <span className="eyebrow">01 — Checkout</span>
              <h2 className="font-display mt-4 text-2xl font-bold tracking-tight uppercase">
                Sign in to check out
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Your cart holds {cartCount} {cartCount === 1 ? "item" : "items"}. Sign in or create
                an account and it moves straight into your account cart — then this wizard picks up
                right where you left off.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/login" search={{ redirect: "/checkout" }} className="btn btn-primary">
                  Sign in
                </Link>
                <Link
                  to="/login"
                  search={{ redirect: "/checkout", mode: "register" }}
                  className="btn btn-quiet"
                >
                  Create account
                </Link>
              </div>
              <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                Guest carts live in this browser until you sign in — nothing is lost in the handoff.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Numbered ruled steps: 01 Shipping → 02 Payment → 03 Review. The red
            underline marks the current step even when labels compress. */}
            <ol className="grid grid-cols-3 gap-4" aria-label="Checkout progress">
              {steps.map((label, index) => {
                const done = index < step;
                const current = index === step;
                return (
                  <li
                    key={label}
                    aria-current={current ? "step" : undefined}
                    className={`flex items-baseline gap-3 border-b-2 pb-3 ${
                      current ? "border-accent" : done ? "border-foreground" : "border-transparent"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`tabular text-sm font-bold ${
                        done ? "text-foreground" : current ? "text-accent" : "text-muted-foreground"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`truncate text-xs font-bold uppercase tracking-[0.14em] sm:text-sm ${
                        done || current ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <div className="mt-12 grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="min-w-0 lg:col-span-8">
                {/* SSR-35 note: the former SSR-20 guest-offer banner was removed —
                unauthenticated shoppers with items now meet the hard gate
                above instead of the wizard, so the banner was unreachable. */}
                {step === 0 && (
                  <form
                    id="shipping-form"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      const nextErrors = validateAll(shipping);
                      setErrors(nextErrors);
                      setTouched(Object.fromEntries(FIELD_DEFS.map(([name]) => [name, true])));
                      const firstInvalid = FIELD_DEFS.find(([name]) => nextErrors[name]);
                      if (firstInvalid) {
                        fieldRefs.current.get(firstInvalid[0])?.focus();
                        return;
                      }
                      setStep(1);
                    }}
                    className="panel grid gap-5 p-6 sm:grid-cols-2 lg:p-8"
                  >
                    <div className="sm:col-span-2">
                      <h2 className="text-xs font-bold uppercase tracking-[0.14em]">
                        Shipping method
                      </h2>
                      <div className="rule mt-3" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        Rates and ETAs come from the server; the quote re-prices when you change it.
                      </p>
                      <div
                        role="radiogroup"
                        aria-label="Shipping method"
                        className="mt-4 space-y-3"
                      >
                        {(methods.data ?? []).map((method) => (
                          <label
                            key={method.code}
                            className={RADIO_CARD(shippingMethod === method.code)}
                          >
                            <span className="flex items-start gap-3">
                              <input
                                type="radio"
                                name="shipping-method"
                                value={method.code}
                                checked={shippingMethod === method.code}
                                onChange={() => {
                                  setShippingMethod(method.code);
                                  setQuote(null);
                                }}
                                className="mt-1 h-4 w-4 accent-accent"
                              />
                              <span>
                                <span className="font-semibold">{method.name}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {method.description} · {method.etaDays.min}–{method.etaDays.max}{" "}
                                  business days
                                </span>
                              </span>
                            </span>
                            <span className="price tabular shrink-0 font-semibold">
                              {method.price.amountMinor === 0
                                ? "Free"
                                : formatPrice(method.price.amountMinor / 100)}
                            </span>
                          </label>
                        ))}
                        {methods.isPending && (
                          <p className="text-sm text-muted-foreground">Loading shipping methods…</p>
                        )}
                      </div>

                      <h2 className="mt-10 text-xs font-bold uppercase tracking-[0.14em]">
                        Shipping address
                      </h2>
                      <div className="rule mt-3" />
                      <p className="mt-3 text-sm text-muted-foreground">
                        Where the order ships. All fields except apartment are required.
                      </p>
                    </div>

                    {Boolean(addresses.data?.length) && (
                      <fieldset className="sm:col-span-2">
                        <legend className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          Saved addresses
                        </legend>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {(addresses.data ?? []).map((address) => (
                            <label
                              key={address.id}
                              className={RADIO_CARD(
                                selectedAddressId === address.id && !usingNewAddress,
                              )}
                            >
                              <input
                                type="radio"
                                name="saved-address"
                                checked={selectedAddressId === address.id && !usingNewAddress}
                                onChange={() => {
                                  setUsingNewAddress(false);
                                  applyAddress(address.id);
                                }}
                                className="mt-1 h-4 w-4 accent-accent"
                              />
                              <span>
                                <span className="font-semibold">{address.fullName}</span>
                                <span className="block text-xs leading-snug text-muted-foreground">
                                  {address.address1}
                                  {address.address2 ? `, ${address.address2}` : ""}, {address.city},{" "}
                                  {address.state} {address.postalCode}, {address.country}
                                </span>
                              </span>
                            </label>
                          ))}
                          <label className={`${RADIO_CARD(usingNewAddress)} font-semibold`}>
                            <input
                              type="radio"
                              name="saved-address"
                              checked={usingNewAddress}
                              onChange={() => {
                                setUsingNewAddress(true);
                                setSelectedAddressId("");
                              }}
                              className="h-4 w-4 accent-accent"
                            />
                            Use a new address
                          </label>
                        </div>
                      </fieldset>
                    )}

                    {(!addresses.data?.length || usingNewAddress) &&
                      FIELD_DEFS.map(([name, label, type]) => {
                        const invalid = Boolean(touched[name] && errors[name]);
                        return (
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
                              ref={(node) => {
                                if (node) fieldRefs.current.set(name, node);
                                else fieldRefs.current.delete(name);
                              }}
                              required={name !== "address2"}
                              autoComplete={
                                name === "fullName"
                                  ? "name"
                                  : name === "postalCode"
                                    ? "postal-code"
                                    : name
                              }
                              inputMode={name === "postalCode" ? "numeric" : undefined}
                              type={type}
                              value={shipping[name]}
                              aria-invalid={invalid ? "true" : undefined}
                              aria-describedby={invalid ? `${name}-error` : undefined}
                              onBlur={() => {
                                setTouched((current) => ({ ...current, [name]: true }));
                                setErrors((current) => ({
                                  ...current,
                                  [name]: validateField(name, shipping[name]),
                                }));
                              }}
                              onChange={(event) => {
                                const value = event.target.value;
                                setShipping((current) => ({ ...current, [name]: value }));
                                if (touched[name])
                                  setErrors((current) => ({
                                    ...current,
                                    [name]: validateField(name, value),
                                  }));
                              }}
                              className={FIELD}
                            />
                            {invalid && (
                              <span id={`${name}-error`} className="field-error">
                                {errors[name]}
                              </span>
                            )}
                          </label>
                        );
                      })}
                  </form>
                )}
                {step === 1 && (
                  <div className="panel p-6 lg:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center border border-border bg-background text-accent"
                        aria-hidden="true"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </span>
                    </div>
                    <h2 className="font-display mt-6 text-lg font-bold tracking-tight">Payment</h2>
                    <p className="mt-4 border border-border bg-surface-2 p-4 text-sm leading-relaxed text-muted-foreground">
                      Checkout is encrypted end to end. Your details stay private and the full total
                      is confirmed before the order is placed.
                    </p>
                    <label className="mt-6 flex min-h-11 cursor-default items-center gap-3 border border-accent/40 bg-accent/5 px-4 text-sm font-medium">
                      <input
                        required
                        type="radio"
                        checked
                        readOnly
                        name="payment"
                        className="h-4 w-4 accent-accent"
                      />
                      Confirm payment
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
                    {quote && (
                      <ReservationCountdown
                        expiresAt={quote.expiresAt}
                        onRecover={prepareReview}
                        recovering={quoting}
                      />
                    )}
                    <div className="panel p-6 lg:p-7">
                      <div className="flex items-start justify-between gap-4">
                        <h2 className="text-xs font-bold uppercase tracking-[0.14em]">
                          Deliver to
                        </h2>
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
                        <h2 className="text-xs font-bold uppercase tracking-[0.14em]">
                          Shipping & payment
                        </h2>
                        <button
                          type="button"
                          onClick={() => setStep(0)}
                          className="btn btn-ghost btn-sm -mr-3 text-muted-foreground hover:text-foreground"
                        >
                          Edit
                        </button>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {quote?.shippingMethod?.name ?? "Standard delivery"} · Secure payment
                      </p>
                      {quote?.promotion && (
                        <p className="mt-2 text-sm font-semibold text-accent">
                          {quote.promotion.code} applied · {quote.promotion.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {error && (
                  <p
                    role="alert"
                    className="mt-6 border-l-2 border-destructive bg-surface-2 p-4 text-sm leading-relaxed text-destructive"
                  >
                    {error}
                  </p>
                )}
                {!cartLines.length && (
                  <p className="mt-6 border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
                    Your cart is empty, so there is nothing to check out.{" "}
                    <Link to="/shop" className="font-semibold text-accent hover:underline">
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
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Back
                  </button>
                  {step < 2 ? (
                    <button
                      type={step === 0 ? "submit" : "button"}
                      form={step === 0 ? "shipping-form" : undefined}
                      disabled={quoting || !cartLines.length}
                      onClick={step === 1 ? prepareReview : undefined}
                      className="btn btn-primary btn-lg"
                    >
                      {quoting && (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      {quoting ? "Reserving stock…" : "Continue"}
                      {!quoting && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!cartLines.length || submitting || !quote}
                      onClick={placeOrder}
                      className="btn btn-primary btn-lg"
                    >
                      {submitting && (
                        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      {submitting ? (
                        "Placing order…"
                      ) : (
                        <>
                          Place order
                          <span aria-hidden="true">·</span>
                          <span className="tabular">
                            {formatPrice((quote?.totals.total.amountMinor ?? 0) / 100)}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 02 — Summary */}
              <aside className="panel h-fit lg:sticky lg:top-28 lg:col-span-4">
                <div className="p-6 lg:p-7">
                  <span className="eyebrow">02 — Summary</span>
                  <h2 className="font-display mt-4 text-lg font-bold tracking-tight">
                    Order summary
                  </h2>
                  <ul className="mt-6 divide-y divide-border border-y border-border">
                    {cartDetail.map((line) => (
                      <li key={line.lineId} className="flex items-center gap-4 py-4">
                        <img
                          src={line.img}
                          alt=""
                          width={48}
                          height={48}
                          loading="lazy"
                          className="h-12 w-12 shrink-0 border border-border object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{line.name}</p>
                          <p className="price tabular mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(line.unitPrice)} × {line.qty}
                          </p>
                        </div>
                        <span className="price tabular shrink-0 text-sm font-semibold">
                          {formatPrice(line.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-6 space-y-3.5 text-sm">
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="price tabular text-right font-medium">
                        {formatPrice(
                          (quote?.totals.subtotal.amountMinor ?? Math.round(subtotal * 100)) / 100,
                        )}
                      </dd>
                    </div>
                    {Boolean(quote?.totals.discount.amountMinor) && (
                      <div className="grid grid-cols-[1fr_auto] gap-6 text-positive">
                        <dt className="font-medium">Promotion</dt>
                        <dd className="price tabular text-right font-semibold">
                          −{formatPrice((quote?.totals.discount.amountMinor ?? 0) / 100)}
                        </dd>
                      </div>
                    )}
                    {/* SSR-20: rendered purely from the server quote — never computed client-side.
                    Ineligible shoppers never receive the field, so nothing shows for them. */}
                    {Boolean(quote?.totals.welcomeDiscount?.amountMinor) && (
                      <div className="grid grid-cols-[1fr_auto] gap-6 text-destructive">
                        <dt className="font-medium">Welcome discount −5%</dt>
                        <dd className="price tabular text-right font-semibold">
                          −{formatPrice((quote?.totals.welcomeDiscount?.amountMinor ?? 0) / 100)}
                        </dd>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">Shipping</dt>
                      <dd
                        className={
                          (quote?.totals.shipping.amountMinor ?? Math.round(estimateShipping * 100))
                            ? "price tabular text-right font-medium"
                            : "text-right font-semibold text-positive"
                        }
                      >
                        {(quote?.totals.shipping.amountMinor ?? Math.round(estimateShipping * 100))
                          ? formatPrice(
                              (quote?.totals.shipping.amountMinor ??
                                Math.round(estimateShipping * 100)) / 100,
                            )
                          : "Free"}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">{quote ? "Tax" : "Estimated tax"}</dt>
                      <dd className="price tabular text-right font-medium">
                        {formatPrice(
                          (quote?.totals.tax.amountMinor ?? Math.round(estimateTax * 100)) / 100,
                        )}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-foreground pt-4">
                      <dt className="text-xs font-bold uppercase tracking-[0.14em]">
                        {quote ? "Total" : "Estimated total"}
                      </dt>
                      <dd className="price tabular text-right text-3xl leading-none font-bold">
                        {formatPrice(
                          (quote?.totals.total.amountMinor ??
                            Math.round((subtotal + estimateShipping + estimateTax) * 100)) / 100,
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-5 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ShieldCheck
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
                      aria-hidden="true"
                    />
                    {quote
                      ? "These are the server-confirmed totals held by your reservation."
                      : "Totals shown are estimates until the server prepares your order on the review step."}
                  </p>
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/** Ticking mm:ss for the 15-minute reservation window, with a recovery path. */
function ReservationCountdown({
  expiresAt,
  onRecover,
  recovering,
}: {
  expiresAt: string;
  onRecover: () => void;
  recovering: boolean;
}) {
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  // Hydration-safe (SSR-11b): null until mounted — Date.now() never runs during
  // render, so SSR and the first client paint share the "--:--" placeholder.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(Math.max(0, target - Date.now()));
    const id = window.setInterval(() => setRemaining(Math.max(0, target - Date.now())), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const expired = remaining !== null && remaining <= 0;

  if (expired)
    return (
      <div className="border border-deal/40 bg-deal/10 p-4 text-sm" role="alert">
        <p className="font-semibold text-deal">Your reservation expired.</p>
        <p className="mt-1 text-muted-foreground">
          Stock was released back to the catalogue. Re-quote to reserve it again — the cart itself
          is untouched.
        </p>
        <button
          type="button"
          onClick={onRecover}
          disabled={recovering}
          className="btn btn-quiet btn-sm mt-3"
        >
          {recovering ? "Re-quoting…" : "Refresh reservation"}
        </button>
      </div>
    );

  const minutes = Math.floor((remaining ?? 0) / 60_000);
  const seconds = Math.floor(((remaining ?? 0) % 60_000) / 1000);

  return (
    <p
      className="flex items-center gap-2 border border-border bg-surface-2 p-4 text-sm text-muted-foreground"
      aria-live="off"
    >
      <Clock className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <span>
        Stock and totals reserved for{" "}
        <span className="tabular text-base font-bold text-foreground">
          {remaining === null
            ? "--:--"
            : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`}
        </span>
        .
      </span>
    </p>
  );
}
