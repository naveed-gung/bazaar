import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
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

/** Numbered sidebar shared by the four account routes (SSR-07). Active entry
    carries the red left bar; every row keeps a 44px touch height. */
const ACCOUNT_NAV = [
  { num: "01", label: "Overview", to: "/account" },
  { num: "02", label: "Profile", to: "/profile" },
  { num: "03", label: "Addresses", to: "/addresses" },
  { num: "04", label: "Sessions", to: "/sessions" },
  { num: "05", label: "Notifications", to: "/notifications" },
  { num: "06", label: "Returns", to: "/returns" },
];

/** SSR-18 — guest lockout. Lives INSIDE AccountLayout so all four routes that
    render through this shell (/account, /profile, /addresses, /sessions) are
    guarded without touching those files. While auth status is pending the
    layout renders only the standard skeleton panel; once confirmed
    unauthenticated it navigates to /login carrying the current path incl.
    query as ?redirect= (login's safeRedirect accepts same-origin relative
    paths and honours it after sign-in). */
function useAccountGuard() {
  const auth = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => api<AuthStatus>("/auth/status"),
    /* SSR-68 — race-proof the bounce. Right after signup, this cache still
       holds the pre-signup GUEST response and is considered fresh; bouncing on
       it stranded freshly authenticated users on /login with a redirect chain
       that grew on every cycle. Now: always refetch on mount, and treat a
       refetch-in-flight over a stale guest snapshot as still deciding. */
    staleTime: 0,
    refetchOnMount: "always",
  });
  const navigate = useNavigate();
  const location = useLocation();
  const deciding = auth.isPending || auth.isFetching;
  const authenticated = auth.data?.authenticated === true;

  useEffect(() => {
    if (!deciding && !authenticated) {
      // Chain-breaker: never carry a /login?redirect=… URL forward — if the
      // guard somehow fires from the login page itself, default to /account.
      const target = location.pathname.startsWith("/login")
        ? "/account"
        : `${location.pathname}${location.searchStr}`;
      void navigate({ to: "/login", search: { redirect: target } });
    }
  }, [deciding, authenticated, navigate, location.pathname, location.searchStr]);

  return { pending: deciding, authenticated };
}

/**
 * The one account shell (SSR-07): hard-left header over a `.rule-strong`, then
 * an asymmetric 3/9 split — numbered nav rail sticky on desktop, content right.
 * Profile, addresses and sessions render inside this same layout. SSR-18 adds
 * the guest guard here so no account surface ever renders for a guest.
 */
export function AccountLayout({
  active,
  title,
  copy,
  children,
}: {
  active: string;
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  const { pending, authenticated } = useAccountGuard();

  // Auth status still resolving — standard skeleton panel only; never a flash
  // of account chrome that a guest would then be bounced away from.
  if (pending) {
    return (
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16" aria-busy="true">
        <div className="panel mx-auto max-w-xl p-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-9 w-2/3 max-w-xs" />
          <Skeleton className="mt-8 h-11 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="mt-4 h-11 w-full" />
          <Skeleton className="mt-8 h-px w-full" />
          <Skeleton className="mt-6 h-3 w-40" />
          <Skeleton className="mt-4 h-11 w-full" />
        </div>
      </section>
    );
  }

  // Confirmed guest: the redirect to /login is in flight — render nothing so
  // no part of the account surface paints for them.
  if (!authenticated) return null;

  return (
    <>
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Account" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">Account</span>
            <h1 className="headline mt-4 text-[clamp(2.25rem,5vw,4rem)]">{title}</h1>
          </div>
          {copy && (
            <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
              {copy}
            </p>
          )}
        </div>
      </section>

      <section className="shell pb-20 lg:pb-28">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <nav aria-label="Account sections" className="lg:sticky lg:top-28 lg:col-span-3">
            <ol>
              {ACCOUNT_NAV.map((item) => {
                const isActive = item.to === active;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-4 border-b border-border border-l-2 py-3 pr-2 pl-4 transition-colors ${
                        isActive
                          ? "border-l-accent"
                          : "border-l-transparent hover:border-l-foreground"
                      }`}
                    >
                      <span
                        className={`tabular text-xs font-bold ${
                          isActive ? "text-accent" : "text-muted-foreground"
                        }`}
                      >
                        {item.num}
                      </span>
                      <span
                        className={`text-xs font-bold uppercase tracking-[0.14em] ${
                          isActive ? "text-accent" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="min-w-0 lg:col-span-9">{children}</div>
        </div>
      </section>
    </>
  );
}

function Account() {
  const { cartCount, wishlist } = useStore();
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => api<Order[]>("/orders") });
  const auth = useQuery({
    queryKey: ["auth-status"],
    queryFn: () => api<AuthStatus>("/auth/status"),
  });

  return (
    <AccountLayout
      active="/account"
      title="Overview"
      copy="Cart, saved items, authentication status, and orders come from the Bazaar API."
    >
      <div className="space-y-10">
        {/* Oversized tabular counters — the Swiss stat block. */}
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            { label: "Items in cart", value: String(cartCount), to: "/cart" as const },
            { label: "Saved items", value: String(wishlist.length), to: "/wishlist" as const },
            {
              label: "Orders placed",
              value: String(orders.data?.length ?? 0),
              to: "/track-order" as const,
            },
          ].map((card) => (
            <Link key={card.label} to={card.to} className="panel group p-7 hover:border-accent">
              <p className="price tabular text-5xl leading-none font-bold">{card.value}</p>
              <p className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {card.label}
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </p>
            </Link>
          ))}
        </div>

        <section aria-labelledby="account-auth-heading" className="panel p-7">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 ${
                auth.isPending
                  ? "bg-muted-foreground"
                  : auth.data?.authenticated
                    ? "bg-positive"
                    : "bg-deal"
              }`}
            />
            <div>
              <h2
                id="account-auth-heading"
                className="text-xs font-bold uppercase tracking-[0.14em]"
              >
                Authentication
              </h2>
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
        </section>

        <section aria-labelledby="account-orders-heading" className="panel p-7">
          <h2 id="account-orders-heading" className="text-xs font-bold uppercase tracking-[0.14em]">
            Order history
          </h2>
          <div className="rule mt-3" />
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
            /* Hairline rows via spec-matrix: every data table on the site reads
               the same way. */
            <div className="mt-6 overflow-x-auto border border-border">
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
                          className="tabular font-semibold hover:text-accent hover:underline"
                        >
                          {order.reference}
                        </Link>
                      </td>
                      <td className="tabular text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-US")}
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
        </section>
      </div>
    </AccountLayout>
  );
}
