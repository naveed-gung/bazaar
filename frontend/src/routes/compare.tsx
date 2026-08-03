import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Scale, ShoppingBag, Trash2, X } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { SpecTiles, specIcon } from "@/components/spec-sheet";
import { AvailabilityTag, EmptyState, Pill, Rating, Skeleton } from "@/components/ui";
import { api, fromApiProduct, type CatalogProduct } from "@/lib/api";
import { formatPrice, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare products — Bazaar" }] }),
  component: Compare,
});

const COMPARE_LIMIT = 4;

function Compare() {
  const client = useQueryClient();
  const { addToCart } = useStore();
  const [diffOnly, setDiffOnly] = useState(false);
  const [removing, setRemoving] = useState("");
  const comparison = useQuery({
    queryKey: ["comparison"],
    queryFn: () => api<CatalogProduct[]>("/comparison"),
  });

  async function remove(slug: string) {
    setRemoving(slug);
    try {
      await api(`/comparison/${encodeURIComponent(slug)}`, { method: "DELETE" });
      await client.invalidateQueries({ queryKey: ["comparison"] });
    } finally {
      setRemoving("");
    }
  }

  const products = useMemo(() => (comparison.data ?? []).map(fromApiProduct), [comparison.data]);

  /** One row per distinct label, flagged when the products disagree. */
  const rows = useMemo(() => {
    const labels = [...new Set(products.flatMap((product) => product.specs.map((s) => s.label)))];
    return labels.map((label) => {
      const values = products.map(
        (product) => product.specs.find((spec) => spec.label === label)?.value ?? "—",
      );
      return { label, values, differs: new Set(values).size > 1 };
    });
  }, [products]);

  const visibleRows = diffOnly ? rows.filter((row) => row.differs) : rows;
  const bestPrice = products.length > 1 ? Math.min(...products.map((p) => p.price)) : 0;
  const diffCount = rows.filter((row) => row.differs).length;

  return (
    <>
      <PageHero
        eyebrow="Compare"
        title="Product comparison"
        copy="Compare up to four products using live catalog specifications and prices."
      />
      <section className="mx-auto max-w-[1600px] px-6 py-16 lg:px-10 lg:py-24">
        {comparison.isPending ? (
          <CompareSkeleton />
        ) : comparison.error ? (
          <p role="alert" className="text-sm text-destructive">
            {comparison.error.message}
          </p>
        ) : !products.length ? (
          <EmptyState
            icon={<Scale className="h-6 w-6" />}
            title="Nothing to compare yet"
            copy="Add up to four products from any product page and their specifications line up here, row by row."
            action={
              <Link to="/shop" className="btn btn-primary">
                Browse products
              </Link>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                <span className="tabular font-semibold text-foreground">{products.length}</span> of{" "}
                {COMPARE_LIMIT} slots used
                {products.length > 1 && (
                  <>
                    {" · "}
                    <span className="tabular font-semibold text-foreground">
                      {diffCount}
                    </span> of {rows.length} specifications differ
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {products.length > 1 && rows.length > 0 && (
                  <label className="btn btn-quiet btn-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={diffOnly}
                      onChange={(event) => setDiffOnly(event.target.checked)}
                      className="h-4 w-4 shrink-0 accent-signal"
                    />
                    Differences only
                  </label>
                )}
                {products.length < COMPARE_LIMIT && (
                  <Link to="/shop" className="btn btn-quiet btn-sm">
                    <Plus className="h-4 w-4" />
                    Add product
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop: one matrix, sticky labels, hairline rows. */}
            <div className="mt-8 hidden overflow-x-auto rounded-3xl border border-border md:block">
              <table className="spec-matrix min-w-205">
                <caption className="sr-only">
                  Specification comparison for {products.map((p) => p.name).join(", ")}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="spec-matrix-label w-56 align-bottom p-5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Specification
                      </span>
                    </th>
                    {products.map((product) => (
                      <th
                        key={product.slug}
                        scope="col"
                        className="min-w-56 p-5 align-top font-normal"
                      >
                        <CompareHeader
                          product={product}
                          best={products.length > 1 && product.price === bestPrice}
                          removing={removing === product.slug}
                          onRemove={() => void remove(product.slug)}
                          onAdd={() => addToCart(product.slug)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const Icon = specIcon(row.label);
                    return (
                      <tr key={row.label} data-diff={row.differs || undefined}>
                        <th scope="row" className="spec-matrix-label text-sm">
                          <span className="flex items-center gap-2.5">
                            <Icon
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                              aria-hidden="true"
                            />
                            {row.label}
                          </span>
                        </th>
                        {row.values.map((value, index) => (
                          <td
                            key={products[index]?.slug ?? index}
                            className={
                              value === "—"
                                ? "tabular text-sm text-muted-foreground"
                                : "tabular text-sm font-medium"
                            }
                          >
                            {value}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {diffOnly && !visibleRows.length && (
              <p className="mt-6 hidden text-sm text-muted-foreground md:block">
                These products share every published specification.
              </p>
            )}

            {/* Mobile: a matrix would force pinch-zoom, so stack per product. */}
            <div className="mt-8 flex flex-col gap-6 md:hidden">
              {products.map((product) => (
                <article key={product.slug} className="panel p-5">
                  <CompareHeader
                    product={product}
                    best={products.length > 1 && product.price === bestPrice}
                    removing={removing === product.slug}
                    onRemove={() => void remove(product.slug)}
                    onAdd={() => addToCart(product.slug)}
                  />
                  <SpecTiles specs={product.specs} className="mt-5 lg:grid-cols-2" />
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function CompareHeader({
  product,
  best,
  removing,
  onRemove,
  onAdd,
}: {
  product: Product;
  best: boolean;
  removing: boolean;
  onRemove: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${product.name} from comparison`}
        className="btn btn-ghost btn-icon btn-sm absolute right-0 top-0 text-muted-foreground hover:text-destructive"
      >
        {removing ? <Trash2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </button>
      <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
        <img
          src={product.img}
          alt=""
          width={240}
          height={240}
          className="aspect-square w-full max-w-40 rounded-2xl border border-border object-cover"
        />
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Pill tone="signal">{product.brand}</Pill>
        {best && <Pill tone="positive">Best price</Pill>}
      </div>
      <p className="mt-3 pr-10 text-sm font-bold leading-snug">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="hover:text-glow">
          {product.name}
        </Link>
      </p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="tabular text-xl font-extrabold">{formatPrice(product.price)}</span>
        {product.was && (
          <span className="tabular text-xs text-muted-foreground line-through">
            {formatPrice(product.was)}
          </span>
        )}
      </div>
      <Rating rating={product.rating} reviews={product.reviews} className="mt-2 text-xs" />
      <AvailabilityTag availability={product.availability} className="mt-3" />
      <button
        type="button"
        onClick={onAdd}
        disabled={product.availability === "out_of_stock"}
        className="btn btn-primary btn-sm mt-4 w-full"
      >
        <ShoppingBag className="h-4 w-4" />
        {product.availability === "out_of_stock" ? "Out of stock" : "Add to cart"}
      </button>
    </div>
  );
}

function CompareSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      <Skeleton className="h-4 w-64" />
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="panel p-5">
            <Skeleton className="aspect-square w-full max-w-40 rounded-2xl" />
            <Skeleton className="mt-4 h-4 w-4/5" />
            <Skeleton className="mt-3 h-6 w-24" />
            <Skeleton className="mt-4 h-9 w-full rounded-xl" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 h-64 w-full rounded-3xl" />
    </div>
  );
}
