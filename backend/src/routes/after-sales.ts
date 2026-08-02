import { Router } from "express";
import { randomInt } from "node:crypto";
import { MongoServerError, ObjectId } from "mongodb";
import { getDb, getMongoClient } from "../database/client.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { requireActiveGuest } from "../middleware/guest.js";

export const afterSalesRouter = Router();
afterSalesRouter.use(requireActiveGuest);

afterSalesRouter.post("/orders/:reference/cancel", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["reason"]);
  const reason = textField(req.body?.reason, 5, 500);
  const db = await getDb(); const order = await db.collection("orders").findOne({ reference: req.params["reference"], ownerKey: ownerKey(req) });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (order.state === "cancelled" || order.state === "cancellation_requested") { res.json({ data: { reference: order.reference, state: order.state }, meta: { replayed: true } }); return; }
  if (!["confirmed", "processing"].includes(order.state)) throw new AppError(409, "ORDER_NOT_CANCELLABLE", "This order can no longer be cancelled.");
  const cancelledAt = new Date();
  const nextState = order.state === "confirmed" ? "cancelled" : "cancellation_requested";
  const session = (await getMongoClient()).startSession();
  try {
    await session.withTransaction(async () => {
      const changed = await db.collection("orders").updateOne(
        { _id: order._id, state: order.state },
        [{ $set: { state: nextState, cancellationReason: reason, updatedAt: cancelledAt, timeline: { $concatArrays: ["$timeline", [{ state: nextState, at: cancelledAt }]] } } }],
        { session },
      );
      if (!changed.modifiedCount) throw new AppError(409, "ORDER_STATE_CONFLICT", "The order changed. Refresh and retry.");
      if (nextState === "cancelled") {
        for (const line of order.lines as { variantId: string; quantity: number }[]) {
          await db.collection("inventory").updateOne({ variantId: new ObjectId(line.variantId) }, { $inc: { onHand: line.quantity, version: 1 }, $set: { updatedAt: cancelledAt } }, { session });
          await db.collection("inventoryLedger").insertOne({ variantId: new ObjectId(line.variantId), delta: line.quantity, reason: "cancellation", reference: order.reference, idempotencyKey: `cancel:${order._id.toString()}:${line.variantId}`, createdAt: cancelledAt }, { session });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  res.json({ data: { reference: order.reference, state: nextState } });
}));

afterSalesRouter.post("/orders/:reference/returns", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["reason", "resolution"]);
  const reason = textField(req.body?.reason, 5, 500);
  const resolution = req.body?.resolution;
  if (resolution !== "refund" && resolution !== "replacement") throw new AppError(422, "VALIDATION_FAILED", "Choose refund or replacement.");
  const db = await getDb(); const order = await db.collection("orders").findOne({ reference: req.params["reference"], ownerKey: ownerKey(req) });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (order.state !== "delivered") throw new AppError(409, "RETURN_NOT_ELIGIBLE", "Returns are available after delivery.");
  const deliveredEvent = Array.isArray(order.timeline) ? [...order.timeline].reverse().find((event: { state?: string }) => event.state === "delivered") as { at?: Date } | undefined : undefined;
  const deliveredAt = deliveredEvent?.at instanceof Date ? deliveredEvent.at : order.updatedAt instanceof Date ? order.updatedAt : order.createdAt;
  if (!(deliveredAt instanceof Date) || deliveredAt.getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) throw new AppError(409, "RETURN_WINDOW_CLOSED", "The 30-day return window has closed.");
  const existing = await db.collection("returns").findOne({ orderId: order._id, state: { $nin: ["rejected", "closed"] } }); if (existing) throw new AppError(409, "RETURN_EXISTS", "An active return already exists for this order.");
  const now = new Date();
  const session = (await getMongoClient()).startSession();
  let returnId: ObjectId | undefined;
  try {
    await session.withTransaction(async () => {
      const result = await db.collection("returns").insertOne({ reference: rmaReference(now), orderId: order._id, activeOrderId: order._id, ownerKey: ownerKey(req), reason, resolution, state: "requested", createdAt: now, updatedAt: now }, { session });
      returnId = result.insertedId;
      const changed = await db.collection("orders").updateOne(
        { _id: order._id, state: "delivered" },
        [{ $set: { state: "return_requested", updatedAt: now, timeline: { $concatArrays: ["$timeline", [{ state: "return_requested", at: now }]] } } }],
        { session },
      );
      if (!changed.modifiedCount) throw new AppError(409, "ORDER_STATE_CONFLICT", "The order changed. Refresh and retry.");
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new AppError(409, "RETURN_EXISTS", "An active return already exists for this order.");
    throw error;
  } finally {
    await session.endSession();
  }
  if (!returnId) throw new AppError(500, "RETURN_FAILED", "Return request could not be created.");
  res.status(201).json({ data: { id: returnId.toString(), state: "requested" } });
}));

function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) {
  if (Object.keys(body ?? {}).some((key) => !allowed.includes(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown after-sales fields are not allowed.");
}

function textField(value: unknown, min: number, max: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) throw new AppError(422, "VALIDATION_FAILED", `Reason must be between ${min} and ${max} characters.`);
  return text;
}

function rmaReference(now: Date) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const suffix = Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `RMA-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${suffix}`;
}
