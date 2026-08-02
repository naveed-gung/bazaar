import { describe, expect, it } from "vitest";
import { AppError } from "../src/errors.js";
import { assertOrderTransition } from "../src/domain/order-state.js";

describe("order state machine", () => {
  it("allows a normal fulfillment path", () => {
    expect(() => assertOrderTransition("confirmed", "processing")).not.toThrow();
    expect(() => assertOrderTransition("processing", "fulfilled")).not.toThrow();
    expect(() => assertOrderTransition("fulfilled", "shipped")).not.toThrow();
    expect(() => assertOrderTransition("shipped", "delivered")).not.toThrow();
  });

  it("rejects impossible state jumps", () => {
    expect(() => assertOrderTransition("confirmed", "refunded")).toThrowError(AppError);
    expect(() => assertOrderTransition("closed", "processing")).toThrowError(
      "Order cannot move from closed to processing.",
    );
  });
});
