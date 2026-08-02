import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";

type ComparedProduct = {
  slug: string;
  name: string;
  category: string;
  imageUrl: string;
  price: { amountMinor: number };
  specs: { label: string; value: string }[];
};
export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "Compare products — Bazaar" }] }),
  component: Compare,
});
function Compare() {
  const client = useQueryClient();
  const comparison = useQuery({
    queryKey: ["comparison"],
    queryFn: () => api<ComparedProduct[]>("/comparison"),
  });
  async function remove(slug: string) {
    await api(`/comparison/${encodeURIComponent(slug)}`, { method: "DELETE" });
    await client.invalidateQueries({ queryKey: ["comparison"] });
  }
  const products = comparison.data ?? [];
  const labels = [
    ...new Set(products.flatMap((product) => product.specs.map((spec) => spec.label))),
  ];
  return (
    <>
      <PageHero
        eyebrow="Compare"
        title="Product comparison"
        copy="Compare up to four products using live catalog specifications and prices."
      />
      <section className="mx-auto max-w-[1600px] overflow-x-auto px-6 py-16 lg:px-10 lg:py-24">
        {comparison.isPending ? (
          <p className="text-sm text-muted-foreground">Loading comparison…</p>
        ) : comparison.error ? (
          <p role="alert" className="text-sm text-destructive">
            {comparison.error.message}
          </p>
        ) : !products.length ? (
          <div>
            <p className="text-muted-foreground">No products selected.</p>
            <Link
              to="/shop"
              className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-signal px-5 text-sm font-semibold text-signal-foreground"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[700px] border-separate border-spacing-3">
            <thead>
              <tr>
                <th className="w-40" />
                <>
                  {products.map((product) => (
                    <th
                      key={product.slug}
                      className="relative rounded-2xl border border-border bg-surface p-5 text-left"
                    >
                      <button
                        onClick={() => void remove(product.slug)}
                        className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full"
                        aria-label={`Remove ${product.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="aspect-square w-full rounded-xl border border-black/10 object-cover dark:border-white/10"
                      />
                      <p className="mt-4 font-bold">{product.name}</p>
                      <p className="mt-2">{formatPrice(product.price.amountMinor / 100)}</p>
                    </th>
                  ))}
                </>
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => (
                <tr key={label}>
                  <th className="p-4 text-left text-sm text-muted-foreground">{label}</th>
                  {products.map((product) => (
                    <td key={product.slug} className="rounded-xl bg-surface p-4 text-sm">
                      {product.specs.find((spec) => spec.label === label)?.value ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
