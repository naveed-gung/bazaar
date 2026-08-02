import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHero } from "@/components/page-hero";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
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
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "rating", label: "Top Rated" },
];

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
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/shop"
            search={{ q, sort }}
            className={`rounded-full border px-5 py-2.5 text-sm transition-colors ${
              category
                ? "border-border text-muted-foreground hover:text-foreground"
                : "border-signal bg-signal/10 text-glow"
            }`}
          >
            All
          </Link>
          {(categories.data ?? []).map((cat) => (
            <Link
              key={cat.slug}
              to="/shop"
              search={{ q, sort, category: cat.slug }}
              className={`rounded-full border px-5 py-2.5 text-sm transition-colors ${
                category === cat.slug
                  ? "border-signal bg-signal/10 text-glow"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          ))}
          <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            {sorts.map((s) => (
              <Link
                key={s.key}
                to="/shop"
                search={{ q, category, sort: s.key === "featured" ? undefined : s.key }}
                className={`rounded-full px-4 py-2 transition-colors ${
                  (sort ?? "featured") === s.key
                    ? "bg-surface-2 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </span>
        </div>

        <p className="mt-8 text-sm text-muted-foreground" aria-live="polite">
          {catalog.isPending ? "Loading catalog…" : `${catalog.data?.total ?? 0} products`}
        </p>

        {catalog.error ? (
          <div className="mt-12 rounded-2xl border border-border bg-surface p-7">
            <p role="alert" className="text-sm text-destructive">
              {catalog.error.message}
            </p>
            <button
              type="button"
              onClick={() => void catalog.refetch()}
              className="mt-5 min-h-11 rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground"
            >
              Retry
            </button>
          </div>
        ) : !catalog.isPending && list.length === 0 ? (
          <p className="mt-16 text-lg text-muted-foreground">
            Nothing matched that search. Try another term or browse all products.
          </p>
        ) : !catalog.isPending ? (
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-10 xl:grid-cols-5">
            {list.map((p, i) => (
              <Reveal key={p.slug} delay={i * 60}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-4">
            <div className="aspect-square animate-pulse rounded-2xl bg-surface" />
            <div className="aspect-square animate-pulse rounded-2xl bg-surface" />
            <div className="aspect-square animate-pulse rounded-2xl bg-surface" />
          </div>
        )}
      </section>
    </>
  );
}
