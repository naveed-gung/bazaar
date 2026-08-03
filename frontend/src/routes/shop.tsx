import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ListFilter, SearchX } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
import { api, fromApiProduct, type CatalogProduct, useCatalogCategories } from "@/lib/api";

type ShopSearch = {
  q?: string | undefined;
  category?: string | undefined;
  sort?: string | undefined;
};

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    sort: typeof search["sort"] === "string" ? search["sort"] : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Shop All Tech — Bazaar" },
      {
        name: "description",
        content:
          "Browse every Bazaar product: audio, wearables, computing, cameras, smart home and gaming gear, filterable by category and price.",
      },
      { property: "og:title", content: "Shop All Tech — Bazaar" },
      {
        property: "og:description",
        content: "Filter and sort the full Bazaar catalogue of modern technology.",
      },
    ],
  }),
  component: Shop,
});

const sorts = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
  { key: "rating", label: "Top Rated" },
];

/* One chip recipe for both rows so category and sort filters read as the same
   control family. Selected state carries border + tint + weight, never colour alone. */
function chip(selected: boolean) {
  return `rounded-full border px-4 py-2 text-sm transition-colors ${
    selected
      ? "border-signal bg-signal/10 font-semibold text-glow"
      : "border-border text-muted-foreground hover:border-signal/40 hover:text-foreground"
  }`;
}

function Shop() {
  const { q, category, sort } = Route.useSearch();
  const categories = useCatalogCategories();

  const catalog = useQuery({
    queryKey: ["catalog", { q, category, sort }],
    queryFn: () =>
      api<{ items: CatalogProduct[]; total: number }>(
        `/catalog/products?${new URLSearchParams(Object.entries({ q, category, sort }).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`,
      ),
  });
  const list = (catalog.data?.items ?? []).map(fromApiProduct);

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title={q ? `Results for “${q}”` : "All Products"}
        copy="Every device we carry is chosen for the same reason: technology that feels effortless in daily use."
      />

      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        <div className="panel p-5 lg:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
                Category
              </p>
              <nav aria-label="Filter by category" className="mt-3.5 flex flex-wrap gap-2">
                <Link to="/shop" search={{ q, sort }} className={chip(!category)}>
                  All
                </Link>
                {(categories.data ?? []).map((cat) => (
                  <Link
                    key={cat.slug}
                    to="/shop"
                    search={{ q, sort, category: cat.slug }}
                    className={chip(category === cat.slug)}
                  >
                    {cat.name}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="lg:shrink-0 lg:text-right">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Sort
              </p>
              <nav
                aria-label="Sort products"
                className="mt-3.5 flex flex-wrap gap-2 lg:justify-end"
              >
                {sorts.map((option) => (
                  <Link
                    key={option.key}
                    to="/shop"
                    search={{
                      q,
                      category,
                      sort: option.key === "featured" ? undefined : option.key,
                    }}
                    className={chip((sort ?? "featured") === option.key)}
                  >
                    {option.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          <p
            className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {catalog.isPending ? (
              "Loading catalog…"
            ) : (
              <>
                <span className="tabular font-semibold text-foreground">
                  {catalog.data?.total ?? 0}
                </span>{" "}
                {catalog.data?.total === 1 ? "product" : "products"}
                {q ? ` matching “${q}”` : ""}
                {category ? " in this category" : ""}
              </>
            )}
          </p>
        </div>

        {catalog.error ? (
          <div className="panel mt-10 p-7">
            <p role="alert" className="text-sm text-destructive">
              {catalog.error.message}
            </p>
            <button
              type="button"
              onClick={() => void catalog.refetch()}
              className="btn btn-primary mt-5"
            >
              Retry
            </button>
          </div>
        ) : catalog.isPending ? (
          <ProductGridSkeleton count={10} />
        ) : list.length === 0 ? (
          <EmptyState
            className="mt-10"
            icon={<SearchX className="h-6 w-6" />}
            title="No products matched"
            copy="Nothing here fits those filters. Widen the category or try a different search term."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse all products
              </Link>
            }
          />
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10 xl:grid-cols-5">
            {list.map((p, i) => (
              <Reveal key={p.slug} delay={i * 60}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
