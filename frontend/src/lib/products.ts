export type Product = {
  slug: string;
  name: string;
  category: string;
  categorySlug: string;
  price: number;
  was?: number;
  rating: number;
  reviews: number;
  img: string;
  motionUrl?: string;
  availability: "in_stock" | "low_stock" | "out_of_stock";
  badge?: "New" | "Deal";
  blurb: string;
  specs: { label: string; value: string }[];
};

export const brands = ["NOVA", "AXIOM", "kestrel", "LUMEN", "ORBIT", "VECTOR"];

export function formatPrice(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
