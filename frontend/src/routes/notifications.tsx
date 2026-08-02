import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
type Notice = { id: string; title: string; body: string; createdAt: string };
export const Route = createFileRoute("/notifications")({ component: Notifications });
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
        {query.isPending && <p className="text-sm text-muted-foreground">Loading notifications…</p>}
        {query.error && (
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p role="alert" className="text-destructive">
              {query.error.message}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="mt-4 min-h-10 rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground"
            >
              Retry
            </button>
          </div>
        )}
        {!query.isPending && !query.data?.length && (
          <p className="text-muted-foreground">No notifications yet.</p>
        )}
        {query.data?.map((notice) => (
          <article key={notice.id} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-bold">{notice.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{notice.body}</p>
            <time className="mt-3 block text-xs text-muted-foreground">
              {new Date(notice.createdAt).toLocaleString()}
            </time>
          </article>
        ))}
      </section>
    </>
  );
}
