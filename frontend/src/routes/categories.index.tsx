import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { INDEX_ROW_ROLL, Reveal, Stagger } from "@/components/motion";
import { EmptyState, Skeleton } from "@/components/ui";
import { useCatalogCategories, useCatalogProducts } from "@/lib/api";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "Shop by Category — Bazaar" },
      {
        name: "description",
        content: "Explore Bazaar's growing collection of modern electronics by category.",
      },
      { property: "og:title", content: "Shop by Category — Bazaar" },
      {
        property: "og:description",
        content: "Curated categories of modern technology at Bazaar.",
      },
    ],
  }),
  component: Categories,
});

function Categories() {
  const categories = useCatalogCategories();
  /** One full listing call backs the per-row product counts; capped at the API max. */
  const all = useCatalogProducts({ limit: "100" });
  const list = categories.data ?? [];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of all.data?.items ?? []) {
      map.set(item.categorySlug, (map.get(item.categorySlug) ?? 0) + 1);
    }
    return map;
  }, [all.data]);

  return (
    <>
      {/* 01 — Index header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Categories" }]} />
        <div className="rule-strong mt-8" />
        <Reveal>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div className="max-w-3xl">
              <span className="eyebrow">01 — Index</span>
              <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">Shop by Category</h1>
            </div>
            <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
              Focused collections built around how people actually use technology day to day.
            </p>
          </div>
        </Reveal>
      </section>

      {/* 02 — The numbered index list */}
      <section className="shell pb-20 lg:pb-28">
        <div className="rule-strong" />
        <span className="eyebrow mt-6">02 — Collections</span>

        {categories.isPending ? (
          <div className="mt-8" aria-busy="true" aria-live="polite">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-8 border-b border-border py-7"
              >
                <Skeleton className="h-3 w-8 shrink-0" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="hidden h-3 w-28 sm:block" />
              </div>
            ))}
          </div>
        ) : categories.error ? (
          <div className="panel mt-8 p-7">
            <p role="alert" className="text-sm text-destructive">
              {categories.error.message}
            </p>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            title="No categories yet"
            copy="Collections appear here as soon as the catalog publishes them."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse all products
              </Link>
            }
            className="mt-8"
          />
        ) : (
          <nav aria-label="Category index" className="mt-8 border-t border-border">
            <Stagger step={40}>
              {list.map((cat, index) => {
                const count = counts.get(cat.slug);
                return (
                  <Link
                    key={cat.slug}
                    to="/categories/$slug"
                    params={{ slug: cat.slug }}
                    className="index-row group"
                  >
                    <span className="index-row-num">{String(index + 1).padStart(2, "0")}</span>
                    <span className="index-row-label h-[1.2em] overflow-hidden">
                      <span className={`block ${INDEX_ROW_ROLL}`}>{cat.name}</span>
                      <span aria-hidden="true" className={`block text-accent ${INDEX_ROW_ROLL}`}>
                        {cat.name}
                      </span>
                    </span>
                    <span className="index-row-meta tabular">
                      {count === undefined
                        ? "Collection"
                        : `${count} ${count === 1 ? "product" : "products"}`}
                    </span>
                    <ArrowRight className="index-row-arrow h-5 w-5" aria-hidden="true" />
                  </Link>
                );
              })}
            </Stagger>
          </nav>
        )}
      </section>
    </>
  );
}
