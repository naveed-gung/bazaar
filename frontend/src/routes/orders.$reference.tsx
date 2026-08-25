import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { cn } from "@/lib/utils";

type Order = {
  reference: string;
  state: string;
  createdAt: string;
  lines: {
    slug: string;
    name: string;
    imageUrl: string;
    quantity: number;
    lineTotal: { amountMinor: number };
  }[];
  totals: { total: { amountMinor: number } };
  timeline: { state: string; at: string }[];
};

/** GET /admin/orders/:reference/invoice — served to the order's owner from the
    stored snapshots, so an old invoice never re-prices itself. */
type Invoice = {
  reference: string;
  issuedAt: string;
  orderCreatedAt: string;
  state: string;
  seller: { name: string; note: string };
  billTo: {
    fullName: string;
    address1: string;
    address2?: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  lines: {
    name: string;
    slug: string;
    quantity: number;
    unitPrice: { amountMinor: number };
    lineTotal: { amountMinor: number };
  }[];
  subtotal: { amountMinor: number } | null;
  discount: { amountMinor: number } | null;
  shipping: { amountMinor: number } | null;
  tax: { amountMinor: number } | null;
  total: { amountMinor: number } | null;
  promotionCode: string | null;
  payment: { method: string; status: string; simulated: boolean; disclosure: string };
  shippingMethod: string;
};

const money = (value: { amountMinor: number } | null) =>
  value ? formatPrice(value.amountMinor / 100) : "—";

export const Route = createFileRoute("/orders/$reference")({
  head: () => ({
    meta: [
      { title: "Order detail — Bazaar" },
      {
        name: "description",
        content: "Server-authorized Bazaar order state, totals, and timeline.",
      },
    ],
  }),
  component: OrderDetail,
});

/** The full order machine — all 19 states the backend can express, in reading
    order: mainline first, then the exception and return branches. */
const STATE_MACHINE = [
  "awaiting_payment",
  "payment_confirmed",
  "confirmed",
  "processing",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "partially_delivered",
  "delivered",
  "closed",
  "payment_failed",
  "cancellation_requested",
  "cancelled",
  "return_requested",
  "return_approved",
  "returned",
  "partially_refunded",
  "refunded",
  "return_rejected",
] as const;

function OrderDetail() {
  const { reference } = Route.useParams();
  const client = useQueryClient();
  const order = useQuery({
    queryKey: ["order", reference],
    queryFn: () => api<Order>(`/orders/${encodeURIComponent(reference)}`),
  });
  const [message, setMessage] = useState("");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  async function loadInvoice() {
    setInvoiceLoading(true);
    setInvoiceError("");
    try {
      setInvoice(await api<Invoice>(`/admin/orders/${encodeURIComponent(reference)}/invoice`));
    } catch (caught) {
      setInvoice(null);
      setInvoiceError(caught instanceof Error ? caught.message : "Invoice unavailable.");
    } finally {
      setInvoiceLoading(false);
    }
  }
  async function cancel() {
    try {
      await api(`/orders/${encodeURIComponent(reference)}/cancel`, { method: "POST" });
      setMessage("Order cancelled.");
      await client.invalidateQueries({ queryKey: ["order", reference] });
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Cancellation failed.");
    }
  }
  return (
    <>
      {/* 01 — Order header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Account", to: "/account" },
            { label: reference },
          ]}
        />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Order</span>
            <h1 className="headline mt-4 text-[clamp(2rem,4.5vw,3.5rem)]">{reference}</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Server-authorized order detail, state, totals, and timeline.
          </p>
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        {order.isPending ? (
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : order.error ? (
          <div className="panel p-8">
            <p role="alert" className="text-sm text-destructive">
              {order.error.message}
            </p>
            <button
              type="button"
              onClick={() => void order.refetch()}
              className="btn btn-quiet mt-6"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : (
          order.data && (
            <div className="space-y-10">
              {/* Status + actions */}
              <div className="panel p-7 lg:p-9">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-2 text-3xl font-bold capitalize tracking-tight">
                      {order.data.state.replaceAll("_", " ")}
                    </p>
                    <p className="tabular mt-2 text-sm text-muted-foreground">
                      Placed {new Date(order.data.createdAt).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    <Pill tone={order.data.state === "cancelled" ? "danger" : "signal"}>
                      {order.data.reference}
                    </Pill>
                    {invoice ? (
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="btn btn-quiet btn-sm"
                      >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        Print invoice
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void loadInvoice()}
                        disabled={invoiceLoading}
                        className="btn btn-quiet btn-sm"
                      >
                        <Printer className="h-4 w-4" aria-hidden="true" />
                        {invoiceLoading ? "Loading invoice…" : "View invoice"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Cancelled / refunded must read unambiguously — worded band,
                    never colour alone. */}
                {(order.data.state === "cancelled" || order.data.state === "refunded") && (
                  <p className="mt-6 border-l-2 border-destructive bg-surface-2 p-4 text-sm text-destructive">
                    This order was {order.data.state}.{" "}
                    {order.data.state === "cancelled"
                      ? "Reserved stock was released back to the catalogue."
                      : "The payment simulator recorded the refund — no real money moved."}
                  </p>
                )}

                {(["confirmed", "processing"].includes(order.data.state) ||
                  order.data.state === "delivered") && (
                  <div className="mt-7 flex flex-wrap gap-3 border-t border-border pt-7">
                    {["confirmed", "processing"].includes(order.data.state) && (
                      <button
                        type="button"
                        onClick={() => void cancel()}
                        className="btn btn-danger"
                      >
                        Cancel order
                      </button>
                    )}
                    {order.data.state === "delivered" && (
                      <Link to="/returns" search={{ reference }} className="btn btn-quiet">
                        Start a return
                      </Link>
                    )}
                  </div>
                )}
                {message && (
                  <p role="status" className="mt-4 text-sm font-semibold text-positive">
                    {message}
                  </p>
                )}
              </div>

              {/* Invoice view — built from the server's stored snapshots and
                  printed with the button in the status panel. */}
              {invoiceError && (
                <p
                  role="alert"
                  className="border-l-2 border-destructive bg-surface-2 p-4 text-sm text-destructive"
                >
                  {invoiceError}
                </p>
              )}
              {invoice && (
                <section aria-labelledby="invoice-heading" className="panel p-7 lg:p-9">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <h2
                      id="invoice-heading"
                      className="text-xs font-bold uppercase tracking-[0.14em]"
                    >
                      Invoice · {invoice.reference}
                    </h2>
                    <p className="tabular text-xs text-muted-foreground">
                      Issued {new Date(invoice.issuedAt).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="rule mt-3" />
                  <div className="mt-5 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Seller
                      </p>
                      <p className="mt-2 text-sm font-semibold">{invoice.seller.name}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {invoice.seller.note}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Bill to
                      </p>
                      <address className="mt-2 text-sm not-italic leading-6 text-muted-foreground">
                        {invoice.billTo.fullName}
                        <br />
                        {invoice.billTo.address1}
                        {invoice.billTo.address2 ? `, ${invoice.billTo.address2}` : ""}
                        <br />
                        {invoice.billTo.city}, {invoice.billTo.state} {invoice.billTo.postalCode}
                        <br />
                        {invoice.billTo.country}
                      </address>
                    </div>
                  </div>
                  <ul className="mt-6 divide-y divide-border border-y border-border">
                    {invoice.lines.map((line) => (
                      <li
                        key={line.slug}
                        className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-6 py-3 text-sm"
                      >
                        <span className="min-w-0 truncate">{line.name}</span>
                        <span className="tabular text-right text-muted-foreground">
                          × {line.quantity}
                        </span>
                        <span className="price tabular text-right font-semibold">
                          {money(line.lineTotal)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <dl className="mt-5 space-y-2.5 text-sm">
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">Subtotal</dt>
                      <dd className="price tabular text-right font-medium">
                        {money(invoice.subtotal)}
                      </dd>
                    </div>
                    {Boolean(invoice.discount?.amountMinor) && (
                      <div className="grid grid-cols-[1fr_auto] gap-6 text-positive">
                        <dt className="font-medium">
                          Promotion{invoice.promotionCode ? ` · ${invoice.promotionCode}` : ""}
                        </dt>
                        <dd className="price tabular text-right font-semibold">
                          −{money(invoice.discount)}
                        </dd>
                      </div>
                    )}
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">Shipping</dt>
                      <dd className="price tabular text-right font-medium">
                        {money(invoice.shipping)}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-6">
                      <dt className="text-muted-foreground">Tax</dt>
                      <dd className="price tabular text-right font-medium">{money(invoice.tax)}</dd>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] items-baseline gap-6 border-t border-foreground pt-3">
                      <dt className="text-xs font-bold uppercase tracking-[0.14em]">Total</dt>
                      <dd className="price tabular text-right text-2xl leading-none font-bold">
                        {money(invoice.total)}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-5 border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
                    {invoice.payment.disclosure} Payment method {invoice.payment.method} · status{" "}
                    {invoice.payment.status}.
                  </p>
                </section>
              )}

              {/* 19-state machine strip: filled squares are visited states, the
                  red square is the current one, hollow squares untouched. */}
              <figure className="panel p-7 lg:p-9">
                <figcaption className="text-xs font-bold uppercase tracking-[0.14em]">
                  State machine
                </figcaption>
                <div className="rule mt-3" />
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-3">
                  {STATE_MACHINE.map((state) => {
                    const visited = order.data!.timeline.some((event) => event.state === state);
                    const current = state === order.data!.state;
                    return (
                      <li key={state} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-2.5 w-2.5 shrink-0",
                            current
                              ? "bg-accent"
                              : visited
                                ? "bg-foreground"
                                : "border border-border",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-[0.08em]",
                            current
                              ? "text-accent"
                              : visited
                                ? "text-foreground"
                                : "text-muted-foreground",
                          )}
                        >
                          {state.replaceAll("_", " ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="sr-only">
                  Filled marks mark states this order has passed through; the red mark is the
                  current state.
                </p>
              </figure>

              {/* Event history — flat ruled rail, red node on the newest event. */}
              {order.data.timeline.length > 0 && (
                <section aria-labelledby="order-timeline-heading" className="panel p-7 lg:p-9">
                  <h2
                    id="order-timeline-heading"
                    className="text-xs font-bold uppercase tracking-[0.14em]"
                  >
                    Timeline
                  </h2>
                  <div className="rule mt-3" />
                  <ol className="mt-6">
                    {[...order.data.timeline].reverse().map((event, index, events) => {
                      const current = index === 0;
                      return (
                        <li
                          key={`${event.state}-${event.at}`}
                          className="relative flex gap-4 pb-6 last:pb-0"
                        >
                          {index < events.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="absolute top-4 bottom-0 left-[5px] w-px bg-border"
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className={cn(
                              "relative mt-1.5 h-2.5 w-2.5 shrink-0",
                              current ? "bg-accent" : "bg-foreground",
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold capitalize">
                              {event.state.replaceAll("_", " ")}
                            </p>
                            <time
                              dateTime={event.at}
                              className="tabular mt-0.5 block text-xs text-muted-foreground"
                            >
                              {new Date(event.at).toLocaleString("en-US")}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>
              )}

              {/* Lines — hairline-divided rows, no card grid. */}
              <ul className="divide-y divide-border border-y border-border">
                {order.data.lines.map((line) => (
                  <li key={line.slug} className="flex items-center gap-4 py-5">
                    <img
                      src={line.imageUrl}
                      alt=""
                      width={80}
                      height={80}
                      loading="lazy"
                      className="h-20 w-20 shrink-0 border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/product/$slug"
                        params={{ slug: line.slug }}
                        className="font-bold hover:text-accent"
                      >
                        {line.name}
                      </Link>
                      <p className="tabular mt-1 text-sm text-muted-foreground">
                        Quantity {line.quantity}
                      </p>
                    </div>
                    <p className="price tabular shrink-0 font-semibold">
                      {formatPrice(line.lineTotal.amountMinor / 100)}
                    </p>
                  </li>
                ))}
              </ul>

              {/* Total — oversized tabular numeral, right-aligned. */}
              <div className="panel p-7">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-6">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                    Total charged
                  </span>
                  <span className="price tabular text-right text-3xl leading-none font-bold">
                    {formatPrice(order.data.totals.total.amountMinor / 100)}
                  </span>
                </div>
              </div>
            </div>
          )
        )}
      </section>
    </>
  );
}
