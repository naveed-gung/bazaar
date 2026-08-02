import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/page-hero";
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
export const Route = createFileRoute("/orders/$reference")({ component: OrderDetail });
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
          <p className="text-muted-foreground">Loading order…</p>
        ) : order.error ? (
          <p role="alert" className="text-destructive">
            {order.error.message}
          </p>
        ) : (
          order.data && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface p-7">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="mt-2 text-2xl font-bold capitalize">
                  {order.data.state.replaceAll("_", " ")}
                </p>
                {["confirmed", "processing"].includes(order.data.state) && (
                  <button
                    onClick={() => void cancel()}
                    className="mt-5 min-h-11 text-sm text-destructive underline"
                  >
                    Cancel order
                  </button>
                )}
                {order.data.state === "delivered" && (
                  <Link
                    to="/returns"
                    search={{ reference }}
                    className="mt-5 inline-flex min-h-11 items-center text-sm underline"
                  >
                    Start a return
                  </Link>
                )}
                {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
              </div>
              <ul className="space-y-3">
                {order.data.lines.map((line) => (
                  <li
                    key={line.slug}
                    className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4"
                  >
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="h-20 w-20 rounded-xl border border-black/10 object-cover dark:border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <Link to="/product/$slug" params={{ slug: line.slug }} className="font-bold">
                        {line.name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">Quantity {line.quantity}</p>
                    </div>
                    <p className="font-semibold">{formatPrice(line.lineTotal.amountMinor / 100)}</p>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl border border-border bg-surface p-7">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatPrice(order.data.totals.total.amountMinor / 100)}</span>
                </div>
              </div>
            </div>
          )
        )}
      </section>
    </>
  );
}
