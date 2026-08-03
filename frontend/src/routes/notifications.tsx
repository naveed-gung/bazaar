import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff, RotateCcw } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { EmptyState, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
type Notice = { id: string; title: string; body: string; createdAt: string };
export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Bazaar" },
      {
        name: "description",
        content: "Order, return, review, and stock updates for your account.",
      },
    ],
  }),
  component: Notifications,
});
function Notifications() {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notice[]>("/notifications"),
  });
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Notifications"
        copy="Order, return, review, and stock updates for your signed-in account."
      />
      <section className="mx-auto max-w-3xl space-y-4 px-6 py-16">
        {query.isPending ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : query.error ? (
          <div className="panel p-7">
            <p role="alert" className="text-sm text-destructive">
              {query.error.message}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="btn btn-quiet mt-6"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : !query.data?.length ? (
          <EmptyState
            icon={<BellOff className="h-6 w-6" />}
            title="Nothing to report"
            copy="Order confirmations, shipping updates, and back-in-stock alerts land here."
            action={
              <Link to="/account" className="btn btn-quiet">
                Back to account
              </Link>
            }
          />
        ) : (
          query.data.map((notice) => (
            /* Left rule + hairline card: a scannable stack where the title is the
               anchor and the timestamp never competes with it. */
            <article key={notice.id} className="panel border-l-2 border-l-signal p-6">
              <h2 className="font-bold">{notice.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{notice.body}</p>
              <time
                dateTime={notice.createdAt}
                className="tabular mt-4 block text-xs text-muted-foreground"
              >
                {new Date(notice.createdAt).toLocaleString()}
              </time>
            </article>
          ))
        )}
      </section>
    </>
  );
}
