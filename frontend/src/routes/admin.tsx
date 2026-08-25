import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { Skeleton } from "@/components/ui";
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
      <section className="shell py-16">
        <nav className="mb-8 flex flex-wrap gap-3" aria-label="Admin sections">
          <Link to="/admin/catalog" className="btn btn-primary">
            Manage products and images
          </Link>
          <Link to="/admin/operations" className="btn btn-quiet">
            Fulfillment and moderation
          </Link>
        </nav>
        {dashboard.isPending ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        ) : dashboard.error ? (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive"
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
                <article key={item.label} className="panel p-6">
                  <p className="tabular text-2xl font-extrabold tracking-tight">{item.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
                </article>
              ))}
          </div>
        )}
      </section>
    </>
  );
}
