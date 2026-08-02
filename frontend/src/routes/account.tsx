import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";
import { useStore } from "@/lib/store";

type Order = {
  reference: string;
  state: string;
  createdAt: string;
  totals: { total: { amountMinor: number } };
};
type AuthStatus = { authenticated: boolean; firebaseConfigured: boolean };

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Account — Bazaar" },
      { name: "description", content: "Manage your Bazaar account and API-backed order history." },
    ],
  }),
  component: Account,
});

function Account() {
  const { cartCount, wishlist } = useStore();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders") });
  const auth = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => api<AuthStatus>("/auth/status"),
  });
  return (
    <>
      <PageHero
        eyebrow="Account"
        title="Your account"
        copy="Cart, saved items, authentication status, and orders come from the Bazaar API."
      />
      <section className="mx-auto grid max-w-[1600px] gap-8 px-6 py-16 lg:grid-cols-3 lg:px-10 lg:py-24">
        {[
          { label: "Items in cart", value: String(cartCount), to: "/cart" as const },
          { label: "Saved items", value: String(wishlist.length), to: "/wishlist" as const },
          {
            label: "Orders placed",
            value: String(orders.data?.length ?? 0),
            to: "/track-order" as const,
          },
        ].map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="rounded-2xl border border-border bg-surface p-9 transition-colors hover:border-signal"
          >
            <p className="text-4xl font-extrabold text-foreground">{card.value}</p>
            <p className="mt-3 text-sm text-muted-foreground">{card.label}</p>
          </Link>
        ))}
        <div className="rounded-2xl border border-border bg-surface p-7 lg:col-span-3">
          <h2 className="font-bold">Authentication</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {auth.isPending
              ? "Checking…"
              : auth.data?.authenticated
                ? "Signed in with a secure Firebase-backed session."
                : auth.data?.firebaseConfigured
                  ? "Guest session active. Sign-in UI becomes available when the public Firebase browser keys are configured."
                  : "Guest session active. Firebase browser configuration is still required."}
          </p>
        </div>
        <nav
          className="grid gap-3 sm:grid-cols-2 lg:col-span-3 lg:grid-cols-5"
          aria-label="Account settings"
        >
          {[
            { label: "Profile", to: "/profile" as const },
            { label: "Addresses", to: "/addresses" as const },
            { label: "Sessions", to: "/sessions" as const },
            { label: "Notifications", to: "/notifications" as const },
            { label: "Returns", to: "/returns" as const },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold hover:border-signal"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="rounded-2xl border border-border bg-surface p-9 lg:col-span-3">
          <h2 className="text-lg font-bold">Order history</h2>
          {orders.isPending ? (
            <LoaderCircle className="mt-8 h-6 w-6 animate-spin" aria-label="Loading orders" />
          ) : orders.error ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {orders.error.message}
            </p>
          ) : !orders.data?.length ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No orders yet. Completed checkout orders will appear here.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="pb-4">Order</th>
                    <th className="pb-4">Date</th>
                    <th className="pb-4">Total</th>
                    <th className="pb-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.map((order) => (
                    <tr key={order.reference} className="border-t border-border">
                      <td className="py-4 font-medium">
                        <Link
                          to="/orders/$reference"
                          params={{ reference: order.reference }}
                          className="underline"
                        >
                          {order.reference}
                        </Link>
                      </td>
                      <td className="py-4 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4">{formatPrice(order.totals.total.amountMinor / 100)}</td>
                      <td className="py-4 capitalize">{order.state.replaceAll("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
