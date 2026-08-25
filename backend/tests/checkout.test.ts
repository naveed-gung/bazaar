import { describe, expect, it } from "vitest";
import { calculateCheckoutTotals, STANDARD_SHIPPING } from "../src/domain/checkout.js";

describe("checkout pricing", () => {
  it("charges shipping and tax below the free-shipping threshold", () => {
    expect(calculateCheckoutTotals(4_000)).toEqual({
      subtotalMinor: 4_000,
      discountMinor: 0,
      shippingMinor: 799,
      taxMinor: 320,
      totalMinor: 5_119,
    });
  });

  it("uses the discounted subtotal for shipping and tax", () => {
    expect(calculateCheckoutTotals(5_000, { percentOff: 10 })).toEqual({
      subtotalMinor: 5_000,
      discountMinor: 500,
      shippingMinor: 799,
      taxMinor: 360,
      totalMinor: 5_659,
    });
  });

  it("caps promotions and keeps free shipping for qualifying totals", () => {
    expect(calculateCheckoutTotals(10_000, { percentOff: 25, maxDiscountMinor: 1_000 })).toEqual({
      subtotalMinor: 10_000,
      discountMinor: 1_000,
      shippingMinor: 0,
      taxMinor: 720,
      totalMinor: 9_720,
    });
  });

  // SSR-20 welcome offer: 500 bps of the post-promotion base, half-up rounded.
  it("applies a standalone welcome discount at 5% with half-up rounding", () => {
    expect(calculateCheckoutTotals(999, undefined, STANDARD_SHIPPING, { rateBps: 500 })).toEqual({
      subtotalMinor: 999,
      discountMinor: 0,
      welcomeDiscountMinor: 50, // round(999 × 0.05) = round(49.95)
      shippingMinor: 799,
      taxMinor: 76, // round(949 × 0.08)
      totalMinor: 1_824, // 949 + 799 + 76
    });
  });

  it("takes the welcome discount off the post-promotion base when stacked", () => {
    expect(
      calculateCheckoutTotals(10_000, { percentOff: 10 }, STANDARD_SHIPPING, { rateBps: 500 }),
    ).toEqual({
      subtotalMinor: 10_000,
      discountMinor: 1_000,
      welcomeDiscountMinor: 450, // 5% of 9 000, not of 10 000
      shippingMinor: 0, // 8 550 clears the free-shipping floor
      taxMinor: 684,
      totalMinor: 9_234,
    });
  });

  it("omits the welcome field entirely when no welcome rule is supplied", () => {
    const totals = calculateCheckoutTotals(4_000);
    expect("welcomeDiscountMinor" in totals).toBe(false);
  });
});
