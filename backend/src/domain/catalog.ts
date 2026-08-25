import { ObjectId, type Db, type Document } from "mongodb";
import type { Availability, ProductImage, ProductOption, ProductSummary, ProductVariantDto } from "@bazaar/shared";

export type ProductDocument = Document & {
  _id: ObjectId;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
  rating: number;
  reviewCount: number;
  /** Legacy single image. Still written by admin create; `images[0].url` mirrors it. */
  imageUrl: string;
  images?: ProductImage[];
  options?: ProductOption[];
  badge?: "New" | "Deal";
  blurb: string;
  specs: { label: string; value: string }[];
  state: "draft" | "published" | "archived";
  publishedAt: Date;
  revision: number;
};

export type VariantDocument = Document & {
  _id: ObjectId;
  productId: ObjectId;
  sku: string;
  name: string;
  /** Option name to chosen value, e.g. `{ Colour: "Midnight" }`. Empty for single-variant products. */
  options: Record<string, string>;
  priceMinor: number;
  compareAtPriceMinor?: number;
  /** Index into the product's `images`, so selecting a variant can swap the hero shot. */
  imageIndex?: number;
  state: "active" | "archived";
};

/** A variant paired with what is actually sellable right now. */
export type VariantStock = { variant: VariantDocument; quantityAvailable: number };

export function availabilityOf(quantityAvailable: number): Availability {
  if (quantityAvailable <= 0) return "out_of_stock";
  return quantityAvailable <= 5 ? "low_stock" : "in_stock";
}

/** Products created through the admin form carry one `imageUrl` and no gallery. */
function galleryOf(product: ProductDocument): ProductImage[] {
  if (product.images?.length) return product.images;
  return [{ url: product.imageUrl, sources: [], alt: product.name, width: 0, height: 0 }];
}

function serializeVariant(entry: VariantStock, product: ProductDocument): ProductVariantDto {
  const { variant, quantityAvailable } = entry;
  return {
    id: variant._id.toHexString() as ProductVariantDto["id"],
    sku: variant.sku,
    optionValues: variant.options ?? {},
    price: { amountMinor: variant.priceMinor, currency: "USD" },
    ...(variant.compareAtPriceMinor
      ? { compareAtPrice: { amountMinor: variant.compareAtPriceMinor, currency: "USD" } }
      : product.compareAtPriceMinor
        ? { compareAtPrice: { amountMinor: product.compareAtPriceMinor, currency: "USD" } }
        : {}),
    imageIndex: variant.imageIndex ?? 0,
    availability: availabilityOf(quantityAvailable),
    quantityAvailable,
  };
}

/**
 * `quantityAvailable` is the product-wide sellable total; `variants` is optional because list
 * endpoints do not always load them. With no variants the product reports a single implicit
 * price point, which is what legacy admin-created products look like.
 */
export function serializeProduct(
  product: ProductDocument,
  quantityAvailable = 0,
  variants: VariantStock[] = [],
): ProductSummary & { specs: ProductDocument["specs"]; revision: number } {
  const images = galleryOf(product);
  const serializedVariants = variants.map((entry) => serializeVariant(entry, product));
  const prices = serializedVariants.length
    ? serializedVariants.map((variant) => variant.price.amountMinor)
    : [product.priceMinor];
  const minMinor = Math.min(...prices);
  const maxMinor = Math.max(...prices);
  return {
    id: product._id.toHexString() as ProductSummary["id"],
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    categorySlug: product.categorySlug,
    price: { amountMinor: minMinor, currency: "USD" },
    ...(product.compareAtPriceMinor
      ? { compareAtPrice: { amountMinor: product.compareAtPriceMinor, currency: "USD" } }
      : {}),
    priceRange: {
      min: { amountMinor: minMinor, currency: "USD" },
      max: { amountMinor: maxMinor, currency: "USD" },
    },
    rating: product.rating,
    reviewCount: product.reviewCount,
    imageUrl: images[0]?.url ?? product.imageUrl,
    images,
    options: product.options ?? [],
    variants: serializedVariants,
    ...(product.badge ? { badge: product.badge } : {}),
    blurb: product.blurb,
    publishedAt: product.publishedAt.toISOString(),
    availability: availabilityOf(quantityAvailable),
    specs: product.specs,
    revision: product.revision,
  };
}

/** Sellable quantity per product id, summed across its active variants. */
export async function inventoryByProduct(db: Db, ids: ObjectId[]): Promise<Map<string, number>> {
  const byProduct = new Map<string, number>();
  if (!ids.length) return byProduct;
  const variants = await db.collection("variants").find({ productId: { $in: ids }, state: "active" }).toArray();
  const inventory = await db.collection("inventory").find({ variantId: { $in: variants.map((item) => item._id) } }).toArray();
  const counts = new Map(inventory.map((item) => [item.variantId.toString(), Math.max(0, Number(item.onHand) - Number(item.reserved))]));
  for (const variant of variants) byProduct.set(variant.productId.toString(), (byProduct.get(variant.productId.toString()) ?? 0) + (counts.get(variant._id.toString()) ?? 0));
  return byProduct;
}

/** Active variants of one product, each with its own sellable quantity. */
export async function variantsWithStock(db: Db, productId: ObjectId): Promise<VariantStock[]> {
  const variants = (await db
    .collection("variants")
    .find({ productId, state: "active" })
    .sort({ priceMinor: 1, _id: 1 })
    .toArray()) as unknown as VariantDocument[];
  if (!variants.length) return [];
  const inventory = await db
    .collection("inventory")
    .find({ variantId: { $in: variants.map((item) => item._id) } })
    .toArray();
  const counts = new Map(
    inventory.map((item) => [item.variantId.toString(), Math.max(0, Number(item.onHand) - Number(item.reserved))]),
  );
  return variants.map((variant) => ({
    variant,
    quantityAvailable: counts.get(variant._id.toHexString()) ?? 0,
  }));
}
