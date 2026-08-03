import { createFileRoute, Link } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";
import { PageHero } from "@/components/page-hero";
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
  return (
    <>
      <PageHero
        eyebrow={category?.name ?? "Category"}
        title={category?.name ?? "Collection"}
        copy="Products published in this category, with live server pricing and availability."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {catalog.error ? (
          <p role="alert" className="text-sm text-destructive">
            {catalog.error.message}
          </p>
        ) : catalog.isPending ? (
          <ProductGridSkeleton count={8} />
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
          />
        ) : (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              <span className="tabular font-semibold text-foreground">
                {catalog.data?.total ?? list.length}
              </span>{" "}
              {(catalog.data?.total ?? list.length) === 1 ? "product" : "products"} in{" "}
              {category?.name ?? "this collection"}
            </p>
            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
              {list.map((product, index) => (
                <Reveal key={product.slug} delay={index * 70}>
                  <ProductCard product={product} />
                </Reveal>
              ))}
            </div>
            <Link to="/shop" className="btn btn-quiet mt-14">
              Browse all products
            </Link>
          </>
        )}
      </section>
    </>
  );
}
