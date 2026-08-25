import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
import { fromApiProduct, useCatalogCategories, useCatalogProducts } from "@/lib/api";

export const Route = createFileRoute("/categories/$slug")({
  head: () => ({
    meta: [
      { title: "Category — Bazaar" },
      { name: "description", content: "Browse a server-backed Bazaar product category." },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const categories = useCatalogCategories();
  const catalog = useCatalogProducts({ category: slug });
  const category = categories.data?.find((item) => item.slug === slug);
  const list = (catalog.data?.items ?? []).map(fromApiProduct);
  const total = catalog.data?.total ?? list.length;

  return (
    <>
      {/* 01 — Category header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", to: "/" },
            { label: "Categories", to: "/categories" },
            { label: category?.name ?? slug },
          ]}
        />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Category</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">
              {category?.name ?? "Collection"}
            </h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Products published in this category, with live server pricing and availability.
          </p>
        </div>
      </section>

      {/* 02 — Results */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Results</span>

        {catalog.error ? (
          <div className="panel mt-8 p-7">
            <p role="alert" className="text-sm text-destructive">
              {catalog.error.message}
            </p>
          </div>
        ) : catalog.isPending ? (
          <div className="mt-10">
            <ProductGridSkeleton count={8} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<PackageOpen className="h-6 w-6" />}
            title="This collection is empty"
            copy="Nothing is published in this category yet. The rest of the catalog is fully stocked."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse all products
              </Link>
            }
            className="mt-8"
          />
        ) : (
          /* Shop-style asymmetric split: sticky category meta rail + results grid. */
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
            <aside className="lg:sticky lg:top-28 lg:col-span-3">
              <p className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                In this collection
              </p>
              <p className="mt-4 flex items-baseline gap-3" aria-live="polite">
                <span className="price tabular text-5xl leading-none font-bold">{total}</span>
                <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                  {total === 1 ? "Product" : "Products"}
                </span>
              </p>
              <Link to="/shop" className="btn btn-quiet mt-8 w-full">
                Browse all products
              </Link>
            </aside>

            <div className="lg:col-span-9">
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:gap-10">
                {list.map((product, index) => (
                  <Reveal key={product.slug} delay={index * 70}>
                    <ProductCard product={product} />
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
