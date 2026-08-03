import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ClipboardCheck, RotateCcw } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pill, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";
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
function OrderDetail() {
  const { reference } = Route.useParams();
  const client = useQueryClient();
  const order = useQuery({
    queryKey: ["order", reference],
    queryFn: () => api<Order>(`/orders/${encodeURIComponent(reference)}`),
  });
  const [message, setMessage] = useState("");
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
      <PageHero
        eyebrow="Order"
        title={reference}
        copy="Server-authorized order detail, state, totals, and timeline."
      />
      <section className="mx-auto max-w-4xl px-6 py-16">
        {order.isPending ? (
          <div className="space-y-6" aria-busy="true">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
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
            <div className="space-y-6">
              <div className="panel p-7 lg:p-9">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Status
                    </p>
                    <p className="mt-2 text-2xl font-extrabold capitalize tracking-tight">
                      {order.data.state.replaceAll("_", " ")}
                    </p>
                    <p className="tabular mt-2 text-sm text-muted-foreground">
                      Placed {new Date(order.data.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Pill tone={order.data.state === "cancelled" ? "danger" : "signal"}>
                    {order.data.reference}
                  </Pill>
                </div>
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
                  <p role="status" className="mt-4 text-sm font-semibold text-glow">
                    {message}
                  </p>
                )}
              </div>

              {order.data.timeline.length > 0 && (
                <div className="panel p-7 lg:p-9">
                  <h2 className="text-lg font-bold tracking-tight">Timeline</h2>
                  {/* Same rail as track-order so a state history reads identically
                      wherever it appears. Newest event carries the signal colour. */}
                  <ol className="mt-6">
                    {[...order.data.timeline].reverse().map((event, index) => {
                      const current = index === 0;
                      return (
                        <li
                          key={`${event.state}-${event.at}`}
                          className="relative flex gap-4 pb-7 last:pb-0"
                        >
                          {!current && (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-1 left-5 top-11 w-px bg-border"
                            />
                          )}
                          <span
                            aria-hidden="true"
                            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                              current
                                ? "border-signal bg-signal text-signal-foreground"
                                : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {current ? (
                              <ClipboardCheck className="h-5 w-5" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 pt-2">
                            <p className="font-semibold capitalize">
                              {event.state.replaceAll("_", " ")}
                            </p>
                            <time className="tabular mt-1 block text-sm text-muted-foreground">
                              {new Date(event.at).toLocaleString()}
                            </time>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              <ul className="space-y-3">
                {order.data.lines.map((line) => (
                  <li key={line.slug} className="panel flex items-center gap-4 p-4">
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="h-20 w-20 rounded-xl border border-black/10 object-cover dark:border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/product/$slug"
                        params={{ slug: line.slug }}
                        className="font-bold hover:text-glow"
                      >
                        {line.name}
                      </Link>
                      <p className="tabular mt-1 text-sm text-muted-foreground">
                        Quantity {line.quantity}
                      </p>
                    </div>
                    <p className="tabular font-semibold">
                      {formatPrice(line.lineTotal.amountMinor / 100)}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="panel p-7">
                <div className="grid grid-cols-[1fr_auto] items-baseline text-lg font-extrabold">
                  <span>Total</span>
                  <span className="tabular text-glow">
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
