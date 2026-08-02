import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";

type AdminOrder = {
  id: string;
  reference: string;
  state: string;
  total: { amountMinor: number };
  customer: string;
  createdAt: string;
};
type AdminReturn = {
  id: string;
  reference: string;
  state: string;
  reason: string;
  resolution: string;
  createdAt: string;
};
type AdminReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  state: string;
  createdAt: string;
};

const nextOrderState: Record<string, string> = {
  confirmed: "processing",
  processing: "fulfilled",
  fulfilled: "shipped",
  shipped: "delivered",
  delivered: "closed",
  cancellation_requested: "cancelled",
};
const nextReturnState: Record<string, string> = {
  requested: "approved",
  approved: "received",
  in_transit: "received",
  received: "refunded",
  refunded: "closed",
  replacement_sent: "closed",
  rejected: "closed",
};

export const Route = createFileRoute("/admin_/operations")({
  head: () => ({ meta: [{ title: "Operations admin — Bazaar" }] }),
  component: OperationsAdmin,
});

function OperationsAdmin() {
  const queryClient = useQueryClient();
  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => api<AdminOrder[]>("/admin/orders"),
  });
  const returns = useQuery({
    queryKey: ["admin-returns"],
    queryFn: () => api<AdminReturn[]>("/admin/returns"),
  });
  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => api<AdminReview[]>("/admin/reviews"),
  });
  const action = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, string> }) =>
      api(path, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-returns"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-reviews"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
      ]);
    },
  });

  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Fulfillment and moderation"
        copy="Advance valid order and return states, then publish or reject verified reviews."
      />
      <section className="mx-auto max-w-[1400px] space-y-12 px-6 py-16">
        <Link to="/admin" className="text-sm font-semibold text-signal hover:underline">
          Back to dashboard
        </Link>
        {action.error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            {action.error.message}
          </p>
        )}
        <AdminSection title="Orders" pending={orders.isPending} error={orders.error?.message}>
          {orders.data?.map((order) => {
            const next = nextOrderState[order.state];
            return (
              <article
                key={order.id}
                className="grid gap-3 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[1fr_1fr_auto] md:items-center"
              >
                <div>
                  <h3 className="font-semibold">{order.reference}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {order.customer} · {formatPrice(order.total.amountMinor / 100)}
                  </p>
                </div>
                <p className="text-sm font-semibold capitalize">
                  {order.state.replaceAll("_", " ")}
                </p>
                {next && (
                  <ActionButton
                    pending={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/admin/orders/${order.reference}/state`,
                        body: { fromState: order.state, state: next },
                      })
                    }
                  >
                    Move to {next.replaceAll("_", " ")}
                  </ActionButton>
                )}
              </article>
            );
          })}
        </AdminSection>
        <AdminSection title="Returns" pending={returns.isPending} error={returns.error?.message}>
          {returns.data?.map((item) => {
            const next = nextReturnState[item.state];
            return (
              <article
                key={item.id}
                className="grid gap-3 rounded-2xl border border-border bg-surface p-5 md:grid-cols-[1fr_1fr_auto] md:items-center"
              >
                <div>
                  <h3 className="font-semibold">{item.reference}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.reason} · {item.resolution}
                  </p>
                </div>
                <p className="text-sm font-semibold capitalize">
                  {item.state.replaceAll("_", " ")}
                </p>
                {next && (
                  <ActionButton
                    pending={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/admin/returns/${item.id}/state`,
                        body: { fromState: item.state, state: next },
                      })
                    }
                  >
                    Move to {next.replaceAll("_", " ")}
                  </ActionButton>
                )}
              </article>
            );
          })}
        </AdminSection>
        <AdminSection
          title="Pending reviews"
          pending={reviews.isPending}
          error={reviews.error?.message}
        >
          {reviews.data?.map((review) => (
            <article key={review.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">
                    {review.title} · {review.rating}/5
                  </h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {review.body}
                  </p>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    pending={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/admin/reviews/${review.id}/state`,
                        body: { state: "published" },
                      })
                    }
                  >
                    Publish
                  </ActionButton>
                  <button
                    disabled={action.isPending}
                    onClick={() =>
                      action.mutate({
                        path: `/admin/reviews/${review.id}/state`,
                        body: { state: "rejected" },
                      })
                    }
                    className="min-h-10 rounded-xl border border-border px-4 text-xs font-semibold disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </AdminSection>
      </section>
    </>
  );
}

function AdminSection({
  title,
  pending,
  error,
  children,
}: {
  title: string;
  pending: boolean;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold">{title}</h2>
      {pending && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

function ActionButton({
  pending,
  onClick,
  children,
}: {
  pending: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      disabled={pending}
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-signal px-4 text-xs font-semibold capitalize text-signal-foreground disabled:opacity-40"
    >
      {pending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}
