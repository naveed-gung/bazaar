export * from "./permissions.js";

export type OpaqueId<T extends string> = string & { readonly __brand: T };

export type ProductId = OpaqueId<"ProductId">;
export type VariantId = OpaqueId<"VariantId">;
export type CartId = OpaqueId<"CartId">;
export type OrderId = OpaqueId<"OrderId">;
export type UserId = OpaqueId<"UserId">;

export type Currency = "USD";

export type Money = {
  amountMinor: number;
  currency: Currency;
};

export type ApiSuccess<T> = { data: T };

export type FieldError = {
  path: string;
  code: string;
  message: string;
};

export type ApiProblem = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  instance: string;
  errors?: FieldError[];
  meta?: Record<string, unknown>;
};

export type ProductImage = {
  /** Renderable default-size URL, e.g. `/catalog/aura-anc-headphones/01-800.webp`. */
  url: string;
  /** The same image at other widths, for `srcset`. Empty for legacy single-file uploads. */
  sources: { width: number; url: string }[];
  alt: string;
  width: number;
  height: number;
};

/** A selectable axis on a product, e.g. `{ name: "Colour", values: ["Graphite", "Sand"] }`. */
export type ProductOption = {
  name: string;
  values: string[];
};

export type ProductVariantDto = {
  id: VariantId;
  sku: string;
  /** Maps each option name to the chosen value. Empty for single-variant products. */
  optionValues: Record<string, string>;
  price: Money;
  compareAtPrice?: Money;
  /** Index into the parent product's `images`, so picking a variant can swap the hero shot. */
  imageIndex: number;
  availability: Availability;
  quantityAvailable: number;
};

export type Availability = "in_stock" | "low_stock" | "out_of_stock";

/** Inclusive price span across a product's active variants. Equal bounds mean a single price. */
export type PriceRange = {
  min: Money;
  max: Money;
};

export type ProductSummary = {
  id: ProductId;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: Money;
  compareAtPrice?: Money;
  priceRange: PriceRange;
  rating: number;
  reviewCount: number;
  /** Derived alias for `images[0]`; retained so existing callers keep working. */
  imageUrl: string;
  images: ProductImage[];
  options: ProductOption[];
  variants: ProductVariantDto[];
  badge?: "New" | "Deal";
  blurb: string;
  publishedAt: string;
  availability: Availability;
};

export type CartLineDto = {
  lineId: string;
  product: ProductSummary;
  variantId: VariantId;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
};

export type CartDto = {
  id: CartId;
  revision: number;
  lines: CartLineDto[];
  subtotal: Money;
  itemCount: number;
};

export const orderStates = [
  "awaiting_payment",
  "payment_failed",
  "payment_confirmed",
  "confirmed",
  "processing",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "partially_delivered",
  "delivered",
  "cancellation_requested",
  "cancelled",
  "return_requested",
  "return_approved",
  "return_rejected",
  "returned",
  "partially_refunded",
  "refunded",
  "closed"
] as const;

export type OrderState = (typeof orderStates)[number];

/** One selectable value in the shop filter rail, with the count of matching products. */
export type FacetBucket = {
  value: string;
  label: string;
  count: number;
};

export type CatalogFacets = {
  brands: FacetBucket[];
  categories: FacetBucket[];
  options: { name: string; buckets: FacetBucket[] }[];
  priceMinor: { min: number; max: number };
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  pages: number;
};

export type CatalogResponse = Paginated<ProductSummary> & {
  facets: CatalogFacets;
};

export type RoleDto = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  /** System roles are seeded and cannot be deleted. */
  system: boolean;
  userCount: number;
};

export type PrincipalDto = {
  id: string;
  email: string | null;
  displayName: string | null;
  roles: string[];
  permissions: string[];
};

export type ShippingMethodDto = {
  code: string;
  name: string;
  description: string;
  price: Money;
  /** Business days, inclusive range. */
  etaDays: { min: number; max: number };
};

export type ReviewDto = {
  id: string;
  productId: ProductId;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  verifiedPurchase: boolean;
  helpfulCount: number;
  /** Whether the current caller has already voted this review helpful. */
  votedHelpful: boolean;
  createdAt: string;
};

export type ReviewSummaryDto = {
  rating: number;
  reviewCount: number;
  /** Count of reviews per star rating, indexed 1-5. */
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

/** One typed entry of the header search autocomplete (API-02). */
export type SuggestionDto =
  | { type: "product"; slug: string; name: string; brand: string; priceMinor: number; imageUrl: string }
  | { type: "category"; slug: string; name: string }
  | { type: "brand"; name: string };
