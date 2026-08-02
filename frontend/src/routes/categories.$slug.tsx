import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
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
        {catalog.isPending && <p className="text-sm text-muted-foreground">Loading products…</p>}
        {catalog.error && (
          <p role="alert" className="text-sm text-destructive">
            {catalog.error.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10">
          {list.map((product, index) => (
            <Reveal key={product.slug} delay={index * 70}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
        <Link
          to="/shop"
          className="mt-14 inline-flex min-h-11 items-center rounded-xl border border-border px-6 text-sm text-muted-foreground hover:border-signal hover:text-foreground"
        >
          Browse all products
        </Link>
      </section>
    </>
  );
}
