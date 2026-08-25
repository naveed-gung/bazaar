import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff, RotateCcw } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";

/** Server shape (GET /notifications): `readAt` is null until the notice is read. */
type Notice = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

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
      {/* 01 — Inbox header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Account", to: "/account" },
            { label: "Notifications" },
          ]}
        />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Inbox</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Notifications</h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Order, return, review, and stock updates for your signed-in account.
          </p>
        </div>
      </section>

      {/* 02 — Read-only feed */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Updates</span>

        <div className="mt-8 max-w-3xl">
          {query.isPending ? (
            <div aria-busy="true" aria-live="polite">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-5 border-b border-border py-6">
                  <Skeleton className="h-2 w-2 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-56 max-w-full" />
                    <Skeleton className="mt-3 h-3 w-full max-w-md" />
                    <Skeleton className="mt-3 h-3 w-32" />
                  </div>
                </div>
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
            query.data.map((notice) => {
              const unread = notice.readAt === null;
              return (
                /* Ruled row; the red square marks unread and is paired with an
                   sr-only word so meaning is never colour alone. */
                <article key={notice.id} className="flex gap-5 border-b border-border py-6">
                  <span className="mt-2 shrink-0">
                    <span
                      className={`block h-2 w-2 ${unread ? "bg-accent" : "border border-border"}`}
                      aria-hidden="true"
                    />
                    {unread && <span className="sr-only">Unread</span>}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold tracking-tight">
                      {notice.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {notice.body}
                    </p>
                    <time
                      dateTime={notice.createdAt}
                      className="tabular mt-3 block text-xs text-muted-foreground"
                    >
                      {new Date(notice.createdAt).toLocaleString("en-US")}
                    </time>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </>
  );
}
