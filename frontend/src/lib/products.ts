export type ProductImageSource = { width: number; url: string };

export type Product = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: number;
  was?: number;
  rating: number;
  reviews: number;
  img: string;
  availability: "in_stock" | "low_stock" | "out_of_stock";
  badge?: "New" | "Deal";
  blurb: string;
  specs: { label: string; value: string }[];
  /** Inclusive variant price span in dollars; equal bounds mean a single price. */
  priceMin?: number;
  priceMax?: number;
  /** Gallery entries with responsive sources — `images[0]` drives card srcset. */
  images?: { url: string; sources: ProductImageSource[]; alt: string }[];
  /** First option axis, rendered as card swatches (usually Colour). */
  swatchName?: string;
  swatches?: string[];
};

export const brands = ["NOVA", "AXIOM", "kestrel", "LUMEN", "ORBIT", "VECTOR"];

export function formatPrice(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Single price prints once; a genuine variant span prints as an en-dash range. */
export function formatPriceRange(min: number, max: number) {
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}
