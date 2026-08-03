import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { Pill, Skeleton } from "@/components/ui";
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
            className="panel group p-9 transition-colors hover:border-signal/50"
          >
            <p className="tabular text-4xl font-extrabold tracking-tight">{card.value}</p>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              {card.label}
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                aria-hidden="true"
              />
            </p>
          </Link>
        ))}
        <div className="panel p-7 lg:col-span-3">
          <div className="flex items-start gap-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                auth.isPending
                  ? "bg-muted-foreground"
                  : auth.data?.authenticated
                    ? "bg-positive"
                    : "bg-deal"
              }`}
              aria-hidden="true"
            />
            <div>
              <h2 className="font-bold">Authentication</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {auth.isPending
                  ? "Checking…"
                  : auth.data?.authenticated
                    ? "Signed in with a secure Firebase-backed session."
                    : auth.data?.firebaseConfigured
                      ? "Guest session active. Sign-in UI becomes available when the public Firebase browser keys are configured."
                      : "Guest session active. Firebase browser configuration is still required."}
              </p>
            </div>
          </div>
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
            <Link key={item.to} to={item.to} className="btn btn-quiet">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="panel p-7 lg:col-span-3 lg:p-9">
          <h2 className="text-lg font-bold tracking-tight">Order history</h2>
          {orders.isPending ? (
            <div className="mt-6 space-y-3" aria-busy="true">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : orders.error ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {orders.error.message}
            </p>
          ) : !orders.data?.length ? (
            <div className="mt-6 flex flex-wrap items-center gap-5">
              <p className="text-sm text-muted-foreground">
                No orders yet. Completed checkout orders appear here with their live state.
              </p>
              <Link to="/shop" className="btn btn-quiet btn-sm">
                Start an order
              </Link>
            </div>
          ) : (
            /* Hairline rows + zebra: same treatment as the comparison matrix so
               every data table on the site reads the same way. */
            <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
              <table className="spec-matrix min-w-130 text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th scope="col">Order</th>
                    <th scope="col">Date</th>
                    <th scope="col">Total</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.map((order) => (
                    <tr key={order.reference}>
                      <td>
                        <Link
                          to="/orders/$reference"
                          params={{ reference: order.reference }}
                          className="tabular font-semibold hover:text-glow hover:underline"
                        >
                          {order.reference}
                        </Link>
                      </td>
                      <td className="tabular text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="tabular font-semibold">
                        {formatPrice(order.totals.total.amountMinor / 100)}
                      </td>
                      <td>
                        <Pill tone={order.state === "cancelled" ? "danger" : "signal"}>
                          {order.state.replaceAll("_", " ")}
                        </Pill>
                      </td>
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
