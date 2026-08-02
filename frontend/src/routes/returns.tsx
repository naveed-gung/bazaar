import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
type ReturnSearch = { reference?: string };
export const Route = createFileRoute("/returns")({
  validateSearch: (search: Record<string, unknown>): ReturnSearch =>
    typeof search["reference"] === "string" ? { reference: search["reference"] } : {},
  component: Returns,
});
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
      setStatus("Return request submitted.");
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
        <form
          onSubmit={submit}
          className="space-y-5 rounded-2xl border border-border bg-surface p-8"
        >
          <label className="block text-sm">
            <span className="text-muted-foreground">Order reference</span>
            <input
              name="reference"
              required
              maxLength={40}
              defaultValue={search.reference}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Reason</span>
            <textarea
              name="reason"
              required
              minLength={5}
              maxLength={500}
              rows={5}
              className="mt-2 w-full rounded-xl border border-border bg-background p-4"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Resolution</span>
            <select
              name="resolution"
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4"
            >
              <option value="refund">Refund</option>
              <option value="replacement">Replacement</option>
            </select>
          </label>
          <button
            disabled={pending}
            className="min-h-11 rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Submitting…" : "Submit return"}
          </button>
          {status && (
            <p
              role={failed ? "alert" : "status"}
              className={`text-sm ${failed ? "text-destructive" : "text-muted-foreground"}`}
            >
              {status}
            </p>
          )}
        </form>
      </section>
    </>
  );
}
