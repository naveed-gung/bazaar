import type { OrderState } from "@bazaar/shared";
import { AppError } from "../errors.js";

const transitions: Readonly<Record<OrderState, readonly OrderState[]>> = {
  awaiting_payment: ["payment_failed", "payment_confirmed", "cancelled"],
  payment_failed: ["awaiting_payment", "cancelled"],
  payment_confirmed: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancellation_requested", "cancelled"],
  processing: ["partially_fulfilled", "fulfilled", "cancellation_requested"],
  partially_fulfilled: ["fulfilled", "partially_delivered"],
  fulfilled: ["shipped"],
  shipped: ["partially_delivered", "delivered"],
  partially_delivered: ["delivered", "return_requested"],
  delivered: ["return_requested", "closed"],
  cancellation_requested: ["cancelled", "processing"],
  cancelled: ["refunded", "closed"],
  return_requested: ["return_approved", "return_rejected"],
  return_approved: ["returned"],
  return_rejected: ["delivered", "closed"],
  returned: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded", "closed"],
  refunded: ["closed"],
  closed: [],
};

export function assertOrderTransition(from: OrderState, to: OrderState): void {
  if (!transitions[from].includes(to)) {
    throw new AppError(409, "INVALID_ORDER_TRANSITION", `Order cannot move from ${from} to ${to}.`);
  }
}
