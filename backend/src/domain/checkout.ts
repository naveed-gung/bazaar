import { config } from "../config.js";

export type CheckoutTotals = {
  subtotalMinor: number;
  discountMinor: number;
  /** SSR-20 additive: present ONLY when the welcome offer applies (> 0), so legacy
   *  totals shapes and toEqual-pinned tests stay byte-compatible without it. */
  welcomeDiscountMinor?: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

/** SSR-20 welcome offer: 5% off, expressed in basis points like every rate here. */
export const WELCOME_DISCOUNT_RATE_BPS = 500;

/** Server-authoritative shipping rule, resolved from the `shippingMethods` collection. */
export type ShippingMethodRule = {
  key: string;
  rateMinor: number;
  freeOverMinor?: number;
};

/**
 * Pinned economics of the legacy hardcoded behaviour: standard shipping costs 799 minor
 * units and becomes free once the discounted subtotal reaches 5 000. `calculateCheckoutTotals`
 * falls back to exactly these numbers when no method is supplied — that is what keeps
 * backend/tests/checkout.test.ts green unedited and historical seeded orders consistent.
 */
export const STANDARD_SHIPPING: ShippingMethodRule = { key: "standard", rateMinor: 799, freeOverMinor: 5_000 };

export function calculateCheckoutTotals(
  subtotalMinor: number,
  promotion?: { percentOff: number; maxDiscountMinor?: number },
  shipping: ShippingMethodRule = STANDARD_SHIPPING,
  welcome?: { rateBps: number },
): CheckoutTotals {
  const rawDiscount = promotion
    ? Math.round((subtotalMinor * promotion.percentOff) / 100)
    : 0;
  const discountMinor = promotion
    ? Math.min(rawDiscount, promotion.maxDiscountMinor ?? subtotalMinor)
    : 0;
  // SSR-20: the welcome offer takes its basis points off the DISCOUNTED base — i.e. the
  // post-promotion remainder — rounded half-up like every other money figure here.
  const afterPromotion = Math.max(0, subtotalMinor - discountMinor);
  const welcomeDiscountMinor = welcome
    ? Math.round((afterPromotion * welcome.rateBps) / 10_000)
    : 0;
  const discountedSubtotal = Math.max(0, afterPromotion - welcomeDiscountMinor);
  const freeOverMinor = shipping.freeOverMinor;
  const shippingMinor = freeOverMinor !== undefined && discountedSubtotal >= freeOverMinor ? 0 : shipping.rateMinor;
  const taxMinor = Math.round(discountedSubtotal * config.taxRate);
  return {
    subtotalMinor,
    discountMinor,
    ...(welcomeDiscountMinor ? { welcomeDiscountMinor } : {}),
    shippingMinor,
    taxMinor,
    totalMinor: discountedSubtotal + shippingMinor + taxMinor,
  };
}
