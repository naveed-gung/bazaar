import { describe, expect, it } from "vitest";
import { calculateCheckoutTotals } from "../src/domain/checkout.js";

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
});
