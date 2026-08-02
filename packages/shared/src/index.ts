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

export type ProductSummary = {
  id: ProductId;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  price: Money;
  compareAtPrice?: Money;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  motionUrl?: string;
  badge?: "New" | "Deal";
  blurb: string;
  publishedAt: string;
  availability: "in_stock" | "low_stock" | "out_of_stock";
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
