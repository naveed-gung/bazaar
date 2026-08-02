import { ObjectId, type Document } from "mongodb";
import type { ProductSummary } from "@bazaar/shared";

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
  imageUrl: string;
  motionUrl?: string;
  badge?: "New" | "Deal";
  blurb: string;
  specs: { label: string; value: string }[];
  state: "draft" | "published" | "archived";
  publishedAt: Date;
  revision: number;
};

export function serializeProduct(product: ProductDocument, quantityAvailable = 0): ProductSummary & { specs: ProductDocument["specs"]; revision: number } {
  return {
    id: product._id.toHexString() as ProductSummary["id"],
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    category: product.category,
    categorySlug: product.categorySlug,
    price: { amountMinor: product.priceMinor, currency: "USD" },
    ...(product.compareAtPriceMinor ? { compareAtPrice: { amountMinor: product.compareAtPriceMinor, currency: "USD" } } : {}),
    rating: product.rating,
    reviewCount: product.reviewCount,
    imageUrl: product.imageUrl,
    ...(product.motionUrl ? { motionUrl: product.motionUrl } : {}),
    ...(product.badge ? { badge: product.badge } : {}),
    blurb: product.blurb,
    publishedAt: product.publishedAt.toISOString(),
    availability: quantityAvailable <= 0 ? "out_of_stock" : quantityAvailable <= 5 ? "low_stock" : "in_stock",
    specs: product.specs,
    revision: product.revision,
  };
}
