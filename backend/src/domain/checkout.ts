export type CheckoutTotals = {
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  totalMinor: number;
};

export function calculateCheckoutTotals(
  subtotalMinor: number,
  promotion?: { percentOff: number; maxDiscountMinor?: number },
): CheckoutTotals {
  const rawDiscount = promotion
    ? Math.round((subtotalMinor * promotion.percentOff) / 100)
    : 0;
  const discountMinor = promotion
    ? Math.min(rawDiscount, promotion.maxDiscountMinor ?? subtotalMinor)
    : 0;
  const discountedSubtotal = Math.max(0, subtotalMinor - discountMinor);
  const shippingMinor = discountedSubtotal >= 5_000 ? 0 : 799;
  const taxMinor = Math.round(discountedSubtotal * 0.08);
  return {
    subtotalMinor,
    discountMinor,
    shippingMinor,
    taxMinor,
    totalMinor: discountedSubtotal + shippingMinor + taxMinor,
  };
}
