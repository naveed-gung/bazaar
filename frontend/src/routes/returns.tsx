import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type ReturnSearch = { reference?: string };

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Start a return — Bazaar" },
      {
        name: "description",
        content: "Request a refund or replacement for a delivered Bazaar order.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): ReturnSearch =>
    typeof search["reference"] === "string" ? { reference: search["reference"] } : {},
  component: Returns,
});

/** `.field` is the shared input recipe from styles.css; mt-2 is local spacing. */
const FIELD = "field mt-2";

/* The return machine exactly as the backend enforces it (admin transition
   table): eight states, forward edges only. The page renders ONLY the states
   reachable from the current one. */
const RETURN_STATES = [
  "requested",
  "approved",
  "in_transit",
  "received",
  "refunded",
  "replacement_sent",
  "rejected",
  "closed",
] as const;

const RETURN_TRANSITIONS: Record<string, readonly string[]> = {
  requested: ["approved", "rejected"],
  approved: ["in_transit", "received"],
  in_transit: ["received"],
  received: ["refunded", "replacement_sent", "closed"],
  refunded: ["closed"],
  replacement_sent: ["closed"],
  rejected: ["closed"],
  closed: [],
};

/** Order state → the return stage it carries (mirrors the backend mapping). */
const ORDER_RETURN_STATE: Record<string, string> = {
  return_requested: "requested",
  return_approved: "approved",
  returned: "received",
  partially_refunded: "refunded",
  return_rejected: "rejected",
  refunded: "closed",
};

function reachableStates(from: string): string[] {
  const seen = new Set<string>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const state = queue.shift() as string;
    for (const next of RETURN_TRANSITIONS[state] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return RETURN_STATES.filter((state) => seen.has(state));
}

function label(state: string): string {
  const words = state.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function Returns() {
  const search = Route.useSearch();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resolvedState, setResolvedState] = useState<string | null>(null);

  // When a reference is supplied we can read its live return stage through the
  // existing order endpoint — no new API surface. Lookup failures simply leave
  // the entry-state diagram showing.
  useEffect(() => {
    if (!search.reference) return;
    let alive = true;
    api<{ state: string }>(`/orders/${encodeURIComponent(search.reference)}`)
      .then((order) => {
        if (alive) setResolvedState(ORDER_RETURN_STATE[order.state] ?? null);
      })
      .catch(() => {
        /* unresolvable reference — keep the entry-state diagram */
      });
    return () => {
      alive = false;
    };
  }, [search.reference]);

  const currentState = submitted ? "requested" : (resolvedState ?? "requested");
  const chain = reachableStates(currentState);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/orders/${encodeURIComponent(String(data.get("reference")))}/returns`, {
        method: "POST",
        body: JSON.stringify({ reason: data.get("reason"), resolution: data.get("resolution") }),
      });
      setFailed(false);
      setSubmitted(true);
      setStatus("Return request submitted. Support replies within one business day.");
    } catch (caught) {
      setFailed(true);
      setStatus(caught instanceof Error ? caught.message : "Return failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {/* 01 — Returns header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Returns" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — After sales</span>
            <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">Start A Return</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Delivered orders can request a refund or replacement through the API.
          </p>
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        <div className="grid items-start gap-10 lg:grid-cols-12">
          {/* Request form — labels, helps and required markers preserved. */}
          <form onSubmit={submit} className="panel space-y-5 p-7 lg:col-span-7 lg:p-9">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em]">Return request</h2>
            <div className="rule" />
            <label className="block text-sm">
              <span className="font-medium">
                Order reference
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <input
                name="reference"
                required
                maxLength={40}
                defaultValue={search.reference}
                aria-describedby="reference-help"
                className={`${FIELD} tabular uppercase tracking-wider`}
              />
              <span id="reference-help" className="field-help">
                Found on your confirmation email and in order history.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">
                Reason
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </span>
              <textarea
                name="reason"
                required
                minLength={5}
                maxLength={500}
                rows={5}
                aria-describedby="reason-help"
                className={`${FIELD} min-h-32 py-3.5`}
              />
              <span id="reason-help" className="field-help">
                At least 5 characters. Describe the fault or the reason for sending it back.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Resolution</span>
              <select name="resolution" className={FIELD}>
                <option value="refund">Refund</option>
                <option value="replacement">Replacement</option>
              </select>
            </label>
            <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
              <button disabled={pending} className="btn btn-primary btn-lg">
                {pending ? "Submitting…" : "Submit return"}
              </button>
              {status && (
                <p
                  role={failed ? "alert" : "status"}
                  aria-live="polite"
                  className={`text-sm font-semibold ${failed ? "text-destructive" : "text-positive"}`}
                >
                  {status}
                </p>
              )}
            </div>
          </form>

          {/* Lifecycle — only transitions allowed from the current state. */}
          <aside aria-labelledby="return-lifecycle-heading" className="lg:col-span-5">
            <div className="panel p-7">
              <h2
                id="return-lifecycle-heading"
                className="text-xs font-bold uppercase tracking-[0.14em]"
              >
                Return lifecycle
              </h2>
              <div className="rule mt-3" />
              <p className="mt-3 text-sm text-muted-foreground">
                {submitted || resolvedState
                  ? "Only the transitions allowed from the current state are shown."
                  : "New requests enter at 01 — Requested."}
              </p>
              <ol className="mt-2">
                {chain.map((state, index) => {
                  const current = state === currentState;
                  const nexts = RETURN_TRANSITIONS[state] ?? [];
                  return (
                    <li
                      key={state}
                      className={cn(
                        "grid grid-cols-[auto_1fr] items-baseline gap-x-4 border-b border-border border-l-2 py-4 pr-1 pl-4",
                        current ? "border-l-accent" : "border-l-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "tabular text-xs font-bold",
                          current ? "text-accent" : "text-muted-foreground",
                        )}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={cn(
                            "flex flex-wrap items-center gap-3 text-sm font-bold uppercase tracking-[0.08em]",
                            current ? "text-accent" : "text-foreground",
                          )}
                        >
                          {label(state)}
                          {current && (
                            <span className="pill border-accent/40 bg-accent/10 text-accent">
                              Current
                            </span>
                          )}
                        </p>
                        {nexts.length > 0 ? (
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span aria-hidden="true">→</span>
                            {nexts.map((next) => (
                              <span key={next} className="pill">
                                {label(next)}
                              </span>
                            ))}
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">Terminal state.</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
