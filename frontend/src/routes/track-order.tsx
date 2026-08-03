import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ClipboardCheck, LoaderCircle } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pill } from "@/components/ui";
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
        <form
          onSubmit={track}
          className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        >
          <label className="sr-only" htmlFor="order-reference">
            Order reference
          </label>
          <input
            id="order-reference"
            required
            maxLength={40}
            autoCapitalize="characters"
            autoComplete="off"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="e.g. BZ-2026-A1B2C3D4"
            className="tabular min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-5 text-sm uppercase tracking-wider outline-none transition-colors focus:border-signal focus:ring-2 focus:ring-signal/25"
          />
          <button disabled={loading} type="submit" className="btn btn-primary shrink-0">
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Looking up…
              </>
            ) : (
              "Track order"
            )}
          </button>
        </form>
        <p className="mt-3 px-1 text-xs text-muted-foreground">
          References look like <span className="tabular font-semibold">BZ-2026-A1B2C3D4</span> and
          only resolve for the session that placed the order.
        </p>
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {order && (
          <div className="panel mt-12 p-6 lg:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Reference
                </p>
                <p className="tabular mt-1.5 text-lg font-bold tracking-tight">{order.reference}</p>
              </div>
              <Pill tone="signal">{order.state.replaceAll("_", " ")}</Pill>
            </div>

            {/* Connected timeline: the rail makes the sequence readable at a glance,
                and the newest event is the one carrying the signal colour. */}
            <ol className="mt-8 border-t border-border pt-8">
              {order.timeline.map((event, index) => {
                const current = index === order.timeline.length - 1;
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
                    <div className="min-w-0 pt-1.5">
                      <p className="font-semibold capitalize">{event.state.replaceAll("_", " ")}</p>
                      <time
                        dateTime={event.at}
                        className="tabular mt-0.5 block text-sm text-muted-foreground"
                      >
                        {new Date(event.at).toLocaleString()}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>
    </>
  );
}
