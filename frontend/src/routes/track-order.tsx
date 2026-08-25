import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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
      {/* 01 — Tracking header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Track order" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Tracking</span>
            <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">Where Is My Order?</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Enter a real Bazaar reference. Orders are only returned to the session that created
            them.
          </p>
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        {/* Reference lookup — sharp field, no rounded chrome. */}
        <form
          onSubmit={track}
          className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-center"
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
            className="field tabular min-w-0 flex-1 uppercase tracking-wider"
          />
          <button disabled={loading} type="submit" className="btn btn-primary shrink-0">
            {loading ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Looking up…
              </>
            ) : (
              "Track order"
            )}
          </button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          References look like <span className="tabular font-semibold">BZ-2026-A1B2C3D4</span> and
          only resolve for the session that placed the order.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-6 border-l-2 border-destructive bg-surface-2 p-4 text-sm text-destructive"
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
                <p className="price tabular mt-1.5 text-2xl font-bold tracking-tight">
                  {order.reference}
                </p>
              </div>
              <Pill tone="signal">{order.state.replaceAll("_", " ")}</Pill>
            </div>

            {/* Flat event rail — square ink nodes, red node on the newest event.
                Same geometry as the order-detail timeline so a state history
                reads identically wherever it appears. */}
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
                        className="absolute top-3 bottom-1 left-[5px] w-px bg-border"
                      />
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative mt-1 h-2.5 w-2.5 shrink-0",
                        current ? "bg-accent" : "bg-foreground",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-semibold capitalize">{event.state.replaceAll("_", " ")}</p>
                      <time
                        dateTime={event.at}
                        className="tabular mt-0.5 block text-sm text-muted-foreground"
                      >
                        {new Date(event.at).toLocaleString("en-US")}
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
