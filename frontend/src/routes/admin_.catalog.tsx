import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ImagePlus, LoaderCircle, PackagePlus } from "lucide-react";
import { PageHero } from "@/components/page-hero";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/products";

type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  state: "draft" | "published" | "archived";
  priceMinor: number;
  imageUrl: string;
  revision: number;
};

type MediaResult = { key: string; url: string; contentType: string; size: number };

export const Route = createFileRoute("/admin_/catalog")({
  head: () => ({ meta: [{ title: "Catalog admin — Bazaar" }] }),
  component: CatalogAdmin,
});

function CatalogAdmin() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api<AdminProduct[]>("/admin/products"),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  const createProduct = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<AdminProduct>("/admin/products", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: async () => {
      setStatus("Product created as a draft.");
      setImageUrl("");
      await refresh();
    },
    onError: (error) => setStatus(error.message),
  });
  const updateProduct = useMutation({
    mutationFn: ({ id, ...input }: { id: string; revision: number; state: string }) =>
      api<AdminProduct>(`/admin/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      setStatus("Product publication state updated.");
      await refresh();
    },
    onError: (error) => setStatus(error.message),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 750_000) throw new Error("Image must be 750 KB or smaller.");
      const dataBase64 = await fileBase64(file);
      return api<MediaResult>("/media", {
        method: "POST",
        body: JSON.stringify({ contentType: file.type, dataBase64 }),
      });
    },
    onSuccess: (media) => {
      setImageUrl(media.url);
      setStatus("Image uploaded and ready for the product.");
    },
    onError: (error) => setStatus(error.message),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    const form = new FormData(event.currentTarget);
    createProduct.mutate({
      slug: form.get("slug"),
      name: form.get("name"),
      brand: form.get("brand"),
      category: form.get("category"),
      categorySlug: form.get("categorySlug"),
      priceMinor: Math.round(Number(form.get("price")) * 100),
      imageUrl: imageUrl || form.get("imageUrl"),
      blurb: form.get("blurb"),
      state: "draft",
    });
  }

  return (
    <>
      <PageHero
        eyebrow="Catalog operations"
        title="Products and media"
        copy="Create products, attach repository or uploaded images, then control publication with optimistic revisions."
      />
      <section className="mx-auto grid max-w-[1400px] gap-10 px-6 py-16 lg:grid-cols-[0.9fr_1.4fr]">
        <div>
          <Link to="/admin" className="text-sm font-semibold text-signal hover:underline">
            Back to dashboard
          </Link>
          <form
            onSubmit={submit}
            className="mt-5 space-y-4 rounded-2xl border border-border bg-surface p-7"
          >
            <div className="flex items-center gap-3">
              <PackagePlus className="h-5 w-5 text-signal" />
              <h2 className="font-bold">New product</h2>
            </div>
            {[
              ["name", "Product name", "Wireless headphones"],
              ["slug", "URL slug", "wireless-headphones"],
              ["brand", "Brand", "Bazaar Audio"],
              ["category", "Category", "Audio"],
              ["categorySlug", "Category slug", "audio"],
              ["price", "Price in USD", "129.00"],
            ].map(([name, label, placeholder]) => (
              <label key={name} className="block text-sm">
                <span className="text-muted-foreground">{label}</span>
                <input
                  name={name}
                  required
                  placeholder={placeholder}
                  type={name === "price" ? "number" : "text"}
                  {...(name === "price" ? { min: 0, step: "0.01" } : {})}
                  className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-signal"
                />
              </label>
            ))}
            <label className="block text-sm">
              <span className="text-muted-foreground">Description</span>
              <textarea
                name="blurb"
                required
                rows={4}
                className="mt-2 w-full rounded-xl border border-border bg-background p-4 outline-none focus:border-signal"
              />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Repository or CDN image URL</span>
              <input
                name="imageUrl"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="/catalog/product.jpg"
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-4 outline-none focus:border-signal"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold">
              {upload.isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              {upload.isPending ? "Uploading…" : "Upload product image"}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                disabled={upload.isPending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload.mutate(file);
                }}
              />
            </label>
            <button
              disabled={createProduct.isPending || upload.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-signal px-6 text-sm font-semibold text-signal-foreground disabled:opacity-40"
            >
              {createProduct.isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {createProduct.isPending ? "Creating…" : "Create draft"}
            </button>
            {status && (
              <p role="status" className="text-sm text-muted-foreground">
                {status}
              </p>
            )}
          </form>
        </div>

        <div>
          <h2 className="text-xl font-bold">Catalog</h2>
          {products.isPending && (
            <p className="mt-5 text-sm text-muted-foreground">Loading products…</p>
          )}
          {products.error && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
            >
              {products.error.message}
            </p>
          )}
          <div className="mt-5 space-y-3">
            {products.data?.map((product) => (
              <article
                key={product.id}
                className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[72px_1fr_auto] sm:items-center"
              >
                <img
                  src={product.imageUrl}
                  alt=""
                  className="h-[72px] w-[72px] rounded-xl border border-border object-cover"
                />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{product.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatPrice(product.priceMinor / 100)} · {product.state} · revision{" "}
                    {product.revision}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.state !== "published" && (
                    <button
                      disabled={updateProduct.isPending}
                      onClick={() =>
                        updateProduct.mutate({
                          id: product.id,
                          revision: product.revision,
                          state: "published",
                        })
                      }
                      className="min-h-10 rounded-xl bg-signal px-4 text-xs font-semibold text-signal-foreground disabled:opacity-40"
                    >
                      Publish
                    </button>
                  )}
                  {product.state !== "archived" && (
                    <button
                      disabled={updateProduct.isPending}
                      onClick={() =>
                        updateProduct.mutate({
                          id: product.id,
                          revision: product.revision,
                          state: "archived",
                        })
                      }
                      className="min-h-10 rounded-xl border border-border px-4 text-xs font-semibold disabled:opacity-40"
                    >
                      Archive
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}
