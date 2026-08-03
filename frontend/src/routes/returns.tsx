import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
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

function Returns() {
  const search = Route.useSearch();
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
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
      <PageHero
        eyebrow="After sales"
        title="Start a return"
        copy="Delivered orders can request a refund or replacement through the API."
      />
      <section className="mx-auto max-w-xl px-6 py-16">
        <form onSubmit={submit} className="panel space-y-5 p-7 lg:p-9">
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
                className={`text-sm font-semibold ${failed ? "text-destructive" : "text-positive"}`}
              >
                {status}
              </p>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
