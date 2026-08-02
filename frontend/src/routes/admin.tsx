import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";
type Dashboard = {
  products: number;
  orders: number;
  openReturns: number;
  customers: number;
  revenue: { amountMinor: number };
};
export const Route = createFileRoute("/admin")({ component: Admin });
function Admin() {
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => api<Dashboard>("/admin/dashboard"),
  });
  return (
    <>
      <PageHero
        eyebrow="Operations"
        title="Admin dashboard"
        copy="RBAC-protected catalog, order, return, customer, and revenue overview."
      />
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            to="/admin/catalog"
            className="inline-flex min-h-11 items-center rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground"
          >
            Manage products and images
          </Link>
          <Link
            to="/admin/operations"
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-6 text-sm font-semibold"
          >
            Fulfillment and moderation
          </Link>
        </div>
        {dashboard.error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-destructive"
          >
            {dashboard.error.message}
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {dashboard.data &&
              [
                { label: "Products", value: dashboard.data.products },
                { label: "Orders", value: dashboard.data.orders },
                { label: "Open returns", value: dashboard.data.openReturns },
                { label: "Customers", value: dashboard.data.customers },
                { label: "Revenue", value: formatPrice(dashboard.data.revenue.amountMinor / 100) },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-2xl border border-border bg-surface p-6"
                >
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
                </article>
              ))}
          </div>
        )}
      </section>
    </>
  );
}
