import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, LoaderCircle } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";

type TrackedOrder = { reference: string; state: string; timeline: { state: string; at: string }[] };
export const Route = createFileRoute("/track-order")({
  head: () => ({
    meta: [
      { title: "Track Your Order — Bazaar" },
      {
        name: "description",
        content: "Track an authorized Bazaar order using its server-issued reference.",
      },
    ],
  }),
  component: TrackOrder,
});

function TrackOrder() {
  const [reference, setReference] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function track(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      setOrder(await api<TrackedOrder>(`/orders/${encodeURIComponent(reference.trim())}`));
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "Order not found.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageHero
        eyebrow="Track order"
        title="Where is my order?"
        copy="Enter a real Bazaar reference. Orders are only returned to the session that created them."
      />
      <section className="mx-auto max-w-3xl px-6 py-16 lg:py-24">
        <form onSubmit={track} className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="order-reference">
            Order reference
          </label>
          <input
            id="order-reference"
            required
            maxLength={40}
            autoCapitalize="characters"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. BZ-2026-A1B2C3D4"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-5 text-sm outline-none focus:border-signal"
          />
          <button
            disabled={loading}
            type="submit"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-signal px-7 text-sm font-semibold text-signal-foreground disabled:opacity-50"
          >
            {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}Track order
          </button>
        </form>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {order && (
          <div className="mt-12 rounded-2xl border border-border bg-surface p-8">
            <p className="text-sm text-muted-foreground">{order.reference}</p>
            <p className="mt-2 text-2xl font-bold capitalize">{order.state.replaceAll("_", " ")}</p>
            <ol className="mt-8 space-y-6">
              {order.timeline.map((event) => (
                <li key={`${event.state}-${event.at}`} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-signal text-signal-foreground">
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold capitalize">{event.state.replaceAll("_", " ")}</p>
                    <time className="text-sm text-muted-foreground">
                      {new Date(event.at).toLocaleString()}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>
    </>
  );
}
