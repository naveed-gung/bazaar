import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ListFilter, SearchX, X } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/motion";
import { Drawer } from "@/components/drawer";
import { FilterRail, type FilterGroup } from "@/components/filter-rail";
import { Pagination } from "@/components/pagination";
import { EmptyState, ProductGridSkeleton } from "@/components/ui";
import { formatPrice } from "@/lib/products";
import { fromApiProduct, useCatalogFacets } from "@/lib/api";
import { cn } from "@/lib/utils";

export type ShopSearch = {
  q?: string | undefined;
  category?: string | undefined;
  sort?: string | undefined;
  page?: number | undefined;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  rating?: number | undefined;
  /** Comma-joined facet values; exploded into repeatable API params. */
  brand?: string | undefined;
  availability?: string | undefined;
} & { [K in `option.${string}`]: string | undefined };

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
  { key: "rating", label: "Top Rated" },
] as const;

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function optionalInt(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => {
    const out: Record<string, unknown> = {
      q: optionalString(search["q"]),
      category: optionalString(search["category"]),
      sort: optionalString(search["sort"]),
      page: optionalInt(search["page"], 1, 100),
      minPrice: optionalInt(search["minPrice"], 0, 99_999_999),
      maxPrice: optionalInt(search["maxPrice"], 0, 99_999_999),
      rating: optionalInt(search["rating"], 1, 5),
      brand: optionalString(search["brand"]),
      availability: optionalString(search["availability"]),
    };
    for (const [key, value] of Object.entries(search)) {
      if (key.startsWith("option.")) out[key] = optionalString(value);
    }
    return out as ShopSearch;
  },

  head: () => ({
    meta: [
      { title: "Shop All Tech — Bazaar" },
      {
        name: "description",
        content:
          "Browse every Bazaar product: audio, wearables, computing, cameras, smart home and gaming gear, filterable by brand, price and options.",
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

/** Search state → repeatable API query params (minor-unit prices included). */
function apiParams(search: ShopSearch, page: number): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = { limit: "12" };
  if (search.q) params["q"] = search.q;
  if (search.category) params["category"] = search.category;
  if (search.sort) params["sort"] = search.sort;
  if (page > 1) params["page"] = String(page);
  if (search.minPrice !== undefined) params["minPrice"] = String(search.minPrice);
  if (search.maxPrice !== undefined) params["maxPrice"] = String(search.maxPrice);
  const brands = splitValues(search.brand);
  if (brands.length) params["brand"] = brands;
  const tiers = splitValues(search.availability);
  if (tiers.length) params["availability"] = tiers;
  if (search.rating !== undefined) params["rating"] = String(search.rating);
  for (const [key, value] of Object.entries(search)) {
    if (!key.startsWith("option.") || typeof value !== "string" || !value) continue;
    params[key] = splitValues(value);
  }
  return params;
}

function splitValues(joined: string | undefined): string[] {
  return (joined ?? "").split(",").filter(Boolean);
}

/** Square sort tag — solid ink fill when pressed, hairline otherwise. */
function chip(selected: boolean) {
  return cn(
    "inline-flex min-h-11 cursor-pointer items-center border px-4 text-xs font-bold uppercase tracking-[0.08em] transition-colors",
    selected
      ? "border-signal bg-signal text-signal-foreground"
      : "border-border bg-transparent text-muted-foreground hover:border-foreground hover:text-foreground",
  );
}

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const page = search.page ?? 1;

  const catalog = useCatalogFacets(apiParams(search, page));
  const facets = catalog.data?.facets;
  const items = catalog.data?.items ?? [];

  function patch(next: Partial<Record<string, string | number | undefined>>) {
    void navigate({
      to: "/shop",
      search: (previous: ShopSearch) => ({ ...previous, ...next, page: undefined }),
    });
  }

  const selected: Record<string, string[]> = {
    brand: splitValues(search.brand),
    category: search.category ? [search.category] : [],
    rating: search.rating !== undefined ? [String(search.rating)] : [],
    availability: splitValues(search.availability),
    ...Object.fromEntries(
      Object.entries(search)
        .filter(([key, value]) => key.startsWith("option.") && value)
        .map(([key, value]) => [key, splitValues(value as string)]),
    ),
  };

  function onToggle(groupId: string, value: string) {
    if (groupId === "brand" || groupId === "availability") {
      const current = splitValues(search[groupId]);
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      patch({ [groupId]: next.join(",") });
    } else if (groupId === "category" || groupId === "rating") {
      const current = selected[groupId]?.[0];
      patch({ [groupId]: current === value ? undefined : value });
    } else {
      const current = selected[groupId] ?? [];
      const next = current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value];
      patch({ [groupId]: next.join(",") });
    }
  }

  const groups: FilterGroup[] = [];
  if (facets?.brands.length)
    groups.push({
      id: "brand",
      label: "Brand",
      options: facets.brands.map((bucket) => ({ ...bucket })),
    });
  if (facets?.categories.length)
    groups.push({
      id: "category",
      label: "Category",
      options: facets.categories.map((bucket) => ({ ...bucket })),
    });
  groups.push({
    id: "rating",
    label: "Rating",
    options: [4, 3, 2].map((stars) => ({ value: String(stars), label: `${stars}★ & up` })),
  });
  groups.push({
    id: "availability",
    label: "Availability",
    options: [
      { value: "in_stock", label: "In stock" },
      { value: "low_stock", label: "Low stock" },
      { value: "out_of_stock", label: "Out of stock" },
    ],
  });
  for (const group of facets?.options ?? []) {
    groups.push({
      id: `option.${group.name}`,
      label: group.name,
      options: group.buckets.map((bucket) => ({
        value: bucket.value,
        label: bucket.value,
        count: bucket.count,
      })),
    });
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  for (const value of splitValues(search.brand))
    activeChips.push({ label: `Brand: ${value}`, clear: () => onToggle("brand", value) });
  if (search.category)
    activeChips.push({
      label: `Category: ${search.category}`,
      clear: () => onToggle("category", search.category!),
    });
  if (search.rating !== undefined)
    activeChips.push({
      label: `${search.rating}★ & up`,
      clear: () => onToggle("rating", String(search.rating)),
    });
  for (const value of splitValues(search.availability))
    activeChips.push({
      label: value.replace("_", " "),
      clear: () => onToggle("availability", value),
    });
  for (const [key, value] of Object.entries(search)) {
    if (!key.startsWith("option.") || typeof value !== "string" || !value) continue;
    const name = key.slice("option.".length);
    for (const entry of splitValues(value))
      activeChips.push({ label: `${name}: ${entry}`, clear: () => onToggle(key, entry) });
  }
  if (search.minPrice !== undefined || search.maxPrice !== undefined) {
    const min = search.minPrice !== undefined ? formatPrice(search.minPrice / 100) : "$0";
    const max = search.maxPrice !== undefined ? formatPrice(search.maxPrice / 100) : "∞";
    activeChips.push({
      label: `${min} – ${max}`,
      clear: () => patch({ minPrice: undefined, maxPrice: undefined }),
    });
  }

  function clearAllFilters() {
    void navigate({ to: "/shop", search: { q: search.q, sort: search.sort } });
  }

  function hrefFor(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(apiParams(search, target))) {
      for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
    }
    const qs = params.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  }

  const rail = (
    <>
      <FilterRail
        title="Filters"
        groups={groups}
        selected={selected}
        onToggle={(groupId, value) => onToggle(groupId, value)}
        {...(activeChips.length ? { onClear: clearAllFilters } : {})}
      />
      <PricePanel search={search} onApply={patch} />
    </>
  );

  return (
    <>
      {/* 01 — Catalogue header */}
      <section className="shell pt-10 pb-12 lg:pt-14 lg:pb-16">
        <Breadcrumbs items={[{ label: "Home", to: "/" }, { label: "Shop" }]} />
        <div className="rule-strong mt-8" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div className="max-w-3xl">
            <span className="eyebrow">01 — Catalogue</span>
            <h1 className="headline mt-4 text-[clamp(2.5rem,6vw,4.5rem)]">
              {search.q ? `Results for “${search.q}”` : "All Products"}
            </h1>
          </div>
          <p className="measure max-w-md pb-2 text-sm leading-relaxed text-muted-foreground">
            Every device we carry is chosen for the same reason: technology that feels effortless in
            daily use.
          </p>
        </div>
      </section>

      {/* 02 — Filters · 03 — Results (asymmetric 3/9 split on lg) */}
      <section className="shell pb-20 lg:pb-28">
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-12">
          <aside className="hidden lg:sticky lg:top-28 lg:col-span-3 lg:block">
            <div className="rule-strong" />
            <span className="eyebrow mt-6">02 — Filters</span>
            <div className="mt-6">{rail}</div>
          </aside>

          <div className="lg:col-span-9">
            <div className="rule-strong" />
            <div className="mt-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <p className="flex items-baseline gap-3" aria-live="polite">
                {catalog.isPending ? (
                  <span className="text-sm text-muted-foreground">Loading catalogue…</span>
                ) : (
                  <>
                    <span className="price tabular text-5xl leading-none font-bold">
                      {catalog.data?.total ?? 0}
                    </span>
                    <span className="text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {(catalog.data?.total ?? 0) === 1 ? "Product" : "Products"}
                      {activeChips.length > 0
                        ? ` · ${activeChips.length} filter${activeChips.length === 1 ? "" : "s"} active`
                        : ""}
                    </span>
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  aria-haspopup="dialog"
                  className="btn btn-quiet btn-sm lg:hidden"
                >
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
                  Filters{activeChips.length ? ` (${activeChips.length})` : ""}
                </button>
                <nav aria-label="Sort products" className="flex flex-wrap gap-2">
                  {SORTS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() =>
                        patch({
                          sort: (search.sort ?? "newest") === option.key ? undefined : option.key,
                        })
                      }
                      aria-pressed={(search.sort ?? "newest") === option.key}
                      className={chip((search.sort ?? "newest") === option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {activeChips.map((entry) => (
                  <button
                    key={entry.label}
                    type="button"
                    onClick={entry.clear}
                    className="group inline-flex min-h-11 cursor-pointer items-center gap-2 border border-accent/40 bg-accent/5 px-3 text-xs font-bold tracking-[0.08em] text-accent uppercase transition-colors hover:bg-accent/10"
                  >
                    {entry.label}
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">Remove filter</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="cursor-pointer text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase underline-offset-4 hover:text-foreground hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            <div className="mt-10">
              {catalog.error ? (
                <div className="panel p-7">
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
                <ProductGridSkeleton count={8} />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={<SearchX className="h-6 w-6" />}
                  title="No products matched"
                  copy={
                    activeChips.length
                      ? `Nothing matches these filters: ${activeChips.map((entry) => entry.label).join(", ")}. Clear one or all to widen the net.`
                      : "Nothing here fits that search. Try a different term."
                  }
                  action={
                    activeChips.length ? (
                      <button type="button" onClick={clearAllFilters} className="btn btn-primary">
                        Clear all filters
                      </button>
                    ) : (
                      <Link2Shop />
                    )
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-8 xl:grid-cols-4">
                    {items.map((product, index) => (
                      <Reveal key={product.slug} delay={Math.min(index, 7) * 60}>
                        <ProductCard product={toListProduct(product)} priority={index < 4} />
                      </Reveal>
                    ))}
                  </div>
                  <Pagination
                    page={page}
                    totalPages={catalog.data?.pages ?? 1}
                    hrefFor={hrefFor}
                    className="mt-14"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" side="left">
        {rail}
        <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border bg-surface p-4">
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="btn btn-primary w-full"
          >
            Show {catalog.data?.total ?? 0} results
          </button>
        </div>
      </Drawer>
    </>
  );
}

function Link2Shop() {
  return (
    <Link to="/shop" className="btn btn-primary">
      Browse all products
    </Link>
  );
}

/** Minor-unit dollars editor for the price dimension; applied via the URL. */
function PricePanel({
  search,
  onApply,
}: {
  search: ShopSearch;
  onApply: (next: Partial<Record<string, string | number | undefined>>) => void;
}) {
  const [min, setMin] = useState(
    search.minPrice !== undefined ? String(search.minPrice / 100) : "",
  );
  const [max, setMax] = useState(
    search.maxPrice !== undefined ? String(search.maxPrice / 100) : "",
  );

  useEffect(() => {
    setMin(search.minPrice !== undefined ? String(search.minPrice / 100) : "");
    setMax(search.maxPrice !== undefined ? String(search.maxPrice / 100) : "");
  }, [search.minPrice, search.maxPrice]);

  function apply() {
    const toMinor = (value: string) => {
      const parsed = Number(value);
      return value.trim() && Number.isFinite(parsed) && parsed >= 0
        ? Math.round(parsed * 100)
        : undefined;
    };
    onApply({ minPrice: toMinor(min), maxPrice: toMinor(max) });
  }

  return (
    <div className="panel mt-4 p-5">
      <h2 className="text-xs font-bold tracking-[0.14em] uppercase">Price</h2>
      <hr className="rule my-4" />
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="price-min">
          Minimum price
        </label>
        <input
          id="price-min"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Min $"
          value={min}
          onChange={(event) => setMin(event.target.value)}
          className="field tabular"
        />
        <span aria-hidden="true" className="text-muted-foreground">
          –
        </span>
        <label className="sr-only" htmlFor="price-max">
          Maximum price
        </label>
        <input
          id="price-max"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Max $"
          value={max}
          onChange={(event) => setMax(event.target.value)}
          className="field tabular"
        />
      </div>
      <button type="button" onClick={apply} className="btn btn-quiet btn-sm mt-3 w-full">
        Apply price
      </button>
    </div>
  );
}

/** Cards consume the legacy view-model; map straight from the summary DTO. */
const toListProduct = fromApiProduct;
