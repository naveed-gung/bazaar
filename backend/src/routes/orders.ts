import { createHash, randomBytes } from "node:crypto";
import { MongoServerError, ObjectId, type ClientSession, type Db, type Document } from "mongodb";
import { Router } from "express";
import { getDb, getMongoClient } from "../database/client.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { serializeCart, type CartDocument } from "../domain/cart.js";
import { calculateCheckoutTotals, STANDARD_SHIPPING, WELCOME_DISCOUNT_RATE_BPS, type ShippingMethodRule } from "../domain/checkout.js";
import { requireActiveGuest } from "../middleware/guest.js";
import { rateLimit } from "../middleware/rate-limit.js";

export const orderRouter = Router();

// SSR-38: PUBLIC promotion validation for the local-first guest cart (SSR-35). Guests keep
// their cart in localStorage and make zero cart calls, so POST /quote — which requires a
// server cart — can no longer validate a promo code for them. This endpoint needs NO cart
// and NO session: it is registered BEFORE the router-level requireActiveGuest, and Express
// matches in registration order, so the handler terminates matching requests before the
// guest middleware ever runs. The lookup mirrors activePromotion exactly (trim → uppercase,
// state "active", startsAt ≤ now < endsAt); unknown/expired codes answer 404 PROMOTION_INVALID.
// A per-route limiter follows the catalog /suggest convention; the app-level /orders limiter
// still applies on top. Signed-in callers are unaffected — checkout keeps re-validating the
// code server-side inside /quote and /checkout regardless of what this endpoint says.
orderRouter.post("/promotions/validate", rateLimit({ name: "promotion-validate", limit: 30, windowMs: 60_000 }), asyncHandler(async (req, res) => {
  if (Object.keys(req.body ?? {}).some((field) => field !== "code")) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown validation fields are not allowed.");
  const rawCode = req.body?.code;
  if (typeof rawCode !== "string" || !/^[A-Za-z0-9_-]{2,40}$/.test(rawCode.trim())) throw new AppError(422, "VALIDATION_FAILED", "Promotion code format is invalid.");
  const db = await getDb();
  const code = rawCode.trim().toUpperCase();
  const now = new Date();
  const promotion = await db.collection("promotions").findOne({ code, state: "active", startsAt: { $lte: now }, endsAt: { $gt: now } });
  if (!promotion) throw new AppError(404, "PROMOTION_INVALID", "Promotion code is invalid or expired.");
  res.json({ data: { valid: true, code: promotion["code"], name: promotion["name"], kind: typeof promotion["kind"] === "string" ? promotion["kind"] : "percentage", value: Number(promotion["percentOff"]) } });
}));

orderRouter.use(requireActiveGuest);
const reservationMinutes = 15;

orderRouter.get("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  const orders = await db.collection("orders").find({ ownerKey: ownerKey(req) }).sort({ createdAt: -1 }).limit(50).toArray();
  res.json({ data: orders.map(publicOrder) });
}));

// API-06: selectable shipping methods, quoted server-side only.
orderRouter.get("/shipping-methods", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const methods = await db.collection<ShippingMethodDocument>("shippingMethods").find({ state: "active" }).sort({ rateMinor: 1 }).toArray();
  res.setHeader("cache-control", "public, max-age=300, stale-while-revalidate=600");
  res.json({ data: methods.map(shippingMethodPublic) });
}));

orderRouter.get("/:reference", asyncHandler(async (req, res) => {
  const db = await getDb();
  const order = await db.collection("orders").findOne({ reference: req.params["reference"], ownerKey: ownerKey(req) });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  res.json({ data: publicOrder(order) });
}));

orderRouter.post("/quote", asyncHandler(async (req, res) => {
  if (Object.keys(req.body ?? {}).some((field) => field !== "promotionCode" && field !== "shippingMethod")) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown quote fields are not allowed.");
  if (req.body?.promotionCode !== undefined && (typeof req.body.promotionCode !== "string" || !/^[A-Za-z0-9_-]{2,40}$/.test(req.body.promotionCode.trim()))) throw new AppError(422, "VALIDATION_FAILED", "Promotion code format is invalid.");
  if (req.body?.shippingMethod !== undefined && (typeof req.body.shippingMethod !== "string" || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(req.body.shippingMethod.trim()))) throw new AppError(422, "VALIDATION_FAILED", "Shipping method format is invalid.");
  const db = await getDb();
  const key = ownerKey(req);
  const cart = await db.collection<CartDocument>("carts").findOne({ ownerKey: key });
  if (!cart || cart.lines.length === 0) throw new AppError(409, "EMPTY_CART", "Add an item before checking out.");
  await assertPurchasableCart(db, cart);
  const priced = await serializeCart(db, cart);
  const promotion = await activePromotion(db, req.body?.promotionCode);
  // The chosen method is resolved server-side from the shippingMethods collection; a client
  // never supplies a rate.
  const method = await resolveShippingMethod(db, req.body?.shippingMethod);
  // SSR-20 welcome offer: quoted ONLY for authenticated principals with zero prior orders.
  // Guests get neither the discount nor any eligibility signal in the payload.
  const welcomeEligible = req.principal.type === "user" && (await welcomeDiscountEligible(db, key));
  const calculated = calculateCheckoutTotals(
    priced.subtotal.amountMinor,
    promotion ? { percentOff: Number(promotion["percentOff"]), maxDiscountMinor: Number(promotion["maxDiscountMinor"] ?? priced.subtotal.amountMinor) } : undefined,
    shippingRule(method),
    ...(welcomeEligible ? [{ rateBps: WELCOME_DISCOUNT_RATE_BPS }] : []),
  );
  const { discountMinor, shippingMinor, taxMinor, totalMinor } = calculated;
  // SSR-20: the offer surfaces as an additive `totals.welcomeDiscount` Money line — present
  // only when applied — so legacy quote/order shapes stay byte-compatible without it.
  const quoteTotals = {
    subtotal: priced.subtotal,
    discount: money(discountMinor),
    ...(calculated.welcomeDiscountMinor ? { welcomeDiscount: money(calculated.welcomeDiscountMinor) } : {}),
    shipping: money(shippingMinor),
    tax: money(taxMinor),
    total: money(totalMinor),
  };
  const quoteId = new ObjectId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + reservationMinutes * 60_000);
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await releaseReservations(db, key, session);
      for (const line of cart.lines) {
        const stock = await db.collection("inventory").findOneAndUpdate(
          { variantId: line.variantId, $expr: { $gte: [{ $subtract: ["$onHand", "$reserved"] }, line.quantity] } },
          { $inc: { reserved: line.quantity, version: 1 }, $set: { updatedAt: now } },
          { session, returnDocument: "after" },
        );
        if (!stock) throw new AppError(409, "INSUFFICIENT_STOCK", "An item sold out while the checkout quote was prepared.");
        await db.collection("reservations").insertOne({ groupId: quoteId, ownerKey: key, cartId: cart._id, variantId: line.variantId, quantity: line.quantity, state: "active", createdAt: now, expiresAt }, { session });
      }
      await db.collection("checkoutQuotes").insertOne({ _id: quoteId, ownerKey: key, cartId: cart._id, cartRevision: cart.revision, state: "active", promotionCode: promotion?.["code"] ?? null, shippingMethod: method.key, totals: quoteTotals, createdAt: now, expiresAt }, { session });
    });
  } finally {
    await session.endSession();
  }
  res.status(201).json({ data: { id: quoteId.toString(), expiresAt: expiresAt.toISOString(), promotion: promotion ? { code: promotion["code"], name: promotion["name"] } : null, shippingMethod: shippingMethodPublic(method), totals: quoteTotals } });
}));

orderRouter.post("/checkout", asyncHandler(async (req, res) => {
  const idempotencyKey = req.header("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) throw new AppError(422, "IDEMPOTENCY_KEY_REQUIRED", "A valid Idempotency-Key header is required.");
  const input = checkoutInput(req.body);
  const { shipping, quoteId } = input;
  if (!ObjectId.isValid(quoteId)) throw new AppError(422, "QUOTE_REQUIRED", "Create a checkout quote before placing the order.");
  const requestFingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");

  const db = await getDb();
  const key = ownerKey(req);
  const existing = await db.collection("orders").findOne({ ownerKey: key, idempotencyKey });
  if (existing) {
    if (existing["requestFingerprint"] !== requestFingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was already used for a different request.");
    res.json({ data: publicOrder(existing), meta: { replayed: true } }); return;
  }
  const cart = await db.collection<CartDocument>("carts").findOne({ ownerKey: key });
  if (!cart || cart.lines.length === 0) throw new AppError(409, "EMPTY_CART", "Add an item before checking out.");
  await assertPurchasableCart(db, cart);
  const quote = await db.collection("checkoutQuotes").findOne({ _id: new ObjectId(quoteId), ownerKey: key, state: "active", expiresAt: { $gt: new Date() } });
  if (!quote || quote["cartRevision"] !== cart.revision) throw new AppError(409, "QUOTE_EXPIRED", "The checkout quote expired or the cart changed. Review totals again.");
  const priced = await serializeCart(db, cart);
  const promotion = await activePromotion(db, quote["promotionCode"]);
  // Re-resolve the quoted method server-side; legacy quotes without a stored key keep the
  // pinned standard economics.
  const method = await resolveShippingMethod(db, typeof quote["shippingMethod"] === "string" ? quote["shippingMethod"] : undefined);
  // SSR-20: recompute welcome eligibility against CURRENT order history. A quote that
  // carried the offer but lost eligibility (an order landed in between) re-prices without
  // it and fails the total match below with 409 PRICE_CHANGED.
  const welcomeNow = req.principal.type === "user" && (await welcomeDiscountEligible(db, key));
  const recalculated = calculateCheckoutTotals(priced.subtotal.amountMinor, promotion ? { percentOff: Number(promotion["percentOff"]), maxDiscountMinor: Number(promotion["maxDiscountMinor"] ?? priced.subtotal.amountMinor) } : undefined, shippingRule(method), ...(welcomeNow ? [{ rateBps: WELCOME_DISCOUNT_RATE_BPS }] : []));
  const quotedTotal = Number((quote["totals"] as { total?: { amountMinor?: number } })?.total?.amountMinor);
  if (quotedTotal !== recalculated.totalMinor) throw new AppError(409, "PRICE_CHANGED", "A price or promotion changed. Review the updated totals before ordering.");
  const reference = `BZ-${new Date().getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const client = await getMongoClient();
  const session = client.startSession();
  let created: Record<string, unknown> | undefined;
  let replayed = false;
  try {
    await session.withTransaction(async () => {
      // SSR-20: authoritative re-validation INSIDE the same transaction as the order insert,
      // so a stale quote can never smuggle the offer past a first order that landed between
      // quote and create. Throwing aborts before any stock moves or documents are written.
      if (welcomeNow && !(await welcomeDiscountEligible(db, key, session))) throw new AppError(409, "PRICE_CHANGED", "A price or promotion changed. Review the updated totals before ordering.");
      const reservations = await db.collection("reservations").find({ groupId: quote._id, ownerKey: key, state: "active", expiresAt: { $gt: new Date() } }, { session }).toArray();
      if (reservations.length !== cart.lines.length) throw new AppError(409, "RESERVATION_EXPIRED", "Reserved stock expired. Review the order again.");
      const reservedByVariant = new Map(reservations.map((reservation) => [String(reservation["variantId"]), Number(reservation["quantity"])]));
      if (cart.lines.some((line) => reservedByVariant.get(line.variantId.toString()) !== line.quantity)) throw new AppError(409, "RESERVATION_MISMATCH", "Reserved stock no longer matches the cart. Review the order again.");
      for (const reservation of reservations) {
        const stock = await db.collection("inventory").updateOne(
          { variantId: reservation["variantId"], reserved: { $gte: reservation["quantity"] }, onHand: { $gte: reservation["quantity"] } },
          { $inc: { onHand: -Number(reservation["quantity"]), reserved: -Number(reservation["quantity"]), version: 1 }, $set: { updatedAt: new Date() } },
          { session },
        );
        if (!stock.modifiedCount) throw new AppError(409, "INSUFFICIENT_STOCK", "Reserved stock could not be consumed.");
        await db.collection("inventoryLedger").insertOne({ variantId: reservation["variantId"], delta: -Number(reservation["quantity"]), reason: "order", reference, idempotencyKey: `${key}:${idempotencyKey}:${reservation["variantId"].toString()}`, createdAt: new Date() }, { session });
      }
      const now = new Date();
      const order = { ownerKey: key, idempotencyKey, requestFingerprint, reference, state: "confirmed", payment: { method: "simulator", status: "confirmed", label: "Demo payment — no charge" }, shipping, shippingMethod: method.key, lines: priced.lines.map((line) => ({ variantId: line.variantId, productId: line.product.id, slug: line.product.slug, name: line.product.name, imageUrl: line.product.imageUrl, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: line.lineTotal })), totals: quote["totals"], promotionCode: quote["promotionCode"], timeline: [{ state: "confirmed", at: now }], createdAt: now, updatedAt: now };
      const result = await db.collection("orders").insertOne(order, { session });
      await db.collection("reservations").updateMany({ groupId: quote._id, state: "active" }, { $set: { state: "consumed", orderId: result.insertedId, updatedAt: now } }, { session });
      await db.collection("checkoutQuotes").updateOne({ _id: quote._id, state: "active" }, { $set: { state: "consumed", orderId: result.insertedId, updatedAt: now } }, { session });
      await db.collection<CartDocument>("carts").updateOne({ _id: cart._id }, { $set: { lines: [], updatedAt: now }, $inc: { revision: 1 } }, { session });
      created = { _id: result.insertedId, ...order };
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const duplicate = await db.collection("orders").findOne({ ownerKey: key, idempotencyKey });
      if (!duplicate || duplicate["requestFingerprint"] !== requestFingerprint) throw error;
      created = duplicate;
      replayed = true;
    } else throw error;
  } finally {
    await session.endSession();
  }
  if (!created) throw new AppError(500, "ORDER_FAILED", "Order could not be created.");
  res.status(replayed ? 200 : 201).json({ data: publicOrder(created), ...(replayed ? { meta: { replayed: true } } : {}) });
}));

async function releaseReservations(db: Db, key: string, session: ClientSession) {
  const reservations = await db.collection("reservations").find({ ownerKey: key, state: "active" }, { session }).toArray();
  for (const reservation of reservations) {
    const quantity = Number(reservation["quantity"]);
    const released = await db.collection("inventory").updateOne({ variantId: reservation["variantId"], reserved: { $gte: quantity } }, { $inc: { reserved: -quantity, version: 1 }, $set: { updatedAt: new Date() } }, { session });
    if (!released.modifiedCount) throw new AppError(409, "INVENTORY_INCONSISTENT", "Reserved stock could not be safely released.");
  }
  if (reservations.length) {
    const groupIds = reservations.map((item) => item["groupId"]);
    await db.collection("reservations").updateMany({ ownerKey: key, state: "active" }, { $set: { state: "superseded", updatedAt: new Date() } }, { session });
    await db.collection("checkoutQuotes").updateMany({ _id: { $in: groupIds }, state: "active" }, { $set: { state: "superseded", updatedAt: new Date() } }, { session });
  }
}

async function activePromotion(db: Db, rawCode: unknown) {
  const code = typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";
  if (!code) return null;
  const now = new Date();
  const promotion = await db.collection("promotions").findOne({ code, state: "active", startsAt: { $lte: now }, endsAt: { $gt: now } });
  if (!promotion) throw new AppError(422, "PROMOTION_INVALID", "Promotion code is invalid or expired.");
  return promotion;
}

/**
 * SSR-20 welcome-offer eligibility: a principal qualifies only while they have ZERO prior
 * orders — any earlier order document (including cancelled/refunded) disqualifies, keeping
 * the offer strictly first-order-ever. Guests never qualify. Because eligibility keys off
 * the orders collection itself via `ownerKey`, a returning customer signing in with an
 * email that already has orders is ineligible automatically (same uid → same ownerKey),
 * and the offer self-extinguishes after the first successful order — no extra state.
 */
async function welcomeDiscountEligible(db: Db, key: string, session?: ClientSession): Promise<boolean> {
  const priorOrders = await db.collection("orders").countDocuments({ ownerKey: key }, { limit: 1, ...(session ? { session } : {}) });
  return priorOrders === 0;
}

function money(amountMinor: number) { return { amountMinor, currency: "USD" }; }
type ShippingInput = {
  fullName: string;
  email: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};
function checkoutInput(body: Record<string, unknown> | undefined) {
  const allowed = new Set(["quoteId", "paymentMethod", "shipping"]);
  if (Object.keys(body ?? {}).some((key) => !allowed.has(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown checkout fields are not allowed.");
  if (body?.["paymentMethod"] !== "simulator") throw new AppError(422, "PAYMENT_METHOD_INVALID", "Use the labeled payment simulator; card numbers are never collected.");
  const rawShipping = body?.["shipping"];
  if (!rawShipping || typeof rawShipping !== "object" || Array.isArray(rawShipping)) throw new AppError(422, "VALIDATION_FAILED", "Complete shipping details are required.");
  const shippingRecord = rawShipping as Record<string, unknown>;
  const allowedShipping = new Set(["fullName", "email", "address1", "address2", "city", "state", "postalCode", "country"]);
  if (Object.keys(shippingRecord).some((key) => !allowedShipping.has(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown shipping fields are not allowed.");
  const field = (key: string, max = 160) => {
    const value = typeof shippingRecord[key] === "string" ? shippingRecord[key].trim() : "";
    if (value.length > max) throw new AppError(422, "VALIDATION_FAILED", `${key} must be ${max} characters or fewer.`);
    return value;
  };
  const shipping: ShippingInput = { fullName: field("fullName", 120), email: field("email", 254).toLowerCase(), address1: field("address1"), address2: field("address2"), city: field("city", 100), state: field("state", 100), postalCode: field("postalCode", 32), country: field("country", 80) };
  if (!shipping.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(shipping.email) || !shipping.address1 || !shipping.city || !shipping.state || !shipping.postalCode || !shipping.country) throw new AppError(422, "VALIDATION_FAILED", "Complete valid shipping details are required.");
  return { quoteId: String(body?.["quoteId"] ?? ""), paymentMethod: "simulator", shipping };
}
async function assertPurchasableCart(db: Db, cart: CartDocument) {
  const variants = await db.collection("variants").find({ _id: { $in: cart.lines.map((line) => line.variantId) }, state: "active" }).toArray();
  if (variants.length !== cart.lines.length) throw new AppError(409, "CART_ITEM_UNAVAILABLE", "A cart item is no longer available. Remove it before checkout.");
  const productIds = variants.map((variant) => variant["productId"] as ObjectId);
  const published = await db.collection("products").countDocuments({ _id: { $in: productIds }, state: "published" });
  if (published !== productIds.length) throw new AppError(409, "CART_ITEM_UNAVAILABLE", "A cart item is no longer published. Remove it before checkout.");
}
function publicOrder(order: Record<string, unknown>) { return { id: String(order["_id"]), reference: order["reference"], state: order["state"], payment: order["payment"], shipping: order["shipping"], shippingMethod: order["shippingMethod"] ?? STANDARD_SHIPPING.key, lines: order["lines"], totals: order["totals"], promotionCode: order["promotionCode"], timeline: order["timeline"], createdAt: order["createdAt"] }; }

type ShippingMethodDocument = Document & {
  _id: ObjectId;
  key: string;
  name: string;
  description: string;
  rateMinor: number;
  freeOverMinor?: number;
  etaDays: [number, number];
  state: "active" | "inactive";
};

function shippingRule(method: ShippingMethodDocument): ShippingMethodRule {
  const freeOverMinor = method.freeOverMinor;
  return { key: method.key, rateMinor: Number(method.rateMinor), ...(freeOverMinor === undefined || freeOverMinor === null ? {} : { freeOverMinor: Number(freeOverMinor) }) };
}

function shippingMethodPublic(method: ShippingMethodDocument) {
  const eta = Array.isArray(method.etaDays) ? method.etaDays : [];
  return { code: method.key, name: method.name, description: method.description, price: money(Number(method.rateMinor)), etaDays: { min: Number(eta[0] ?? 0), max: Number(eta[1] ?? 0) } };
}

/**
 * Server-side resolution of a shipping method key: a client-supplied rate is never trusted.
 * Unknown or inactive keys are 422 — except the pinned standard fallback, which preserves the
 * legacy economics even before the collection has been seeded.
 */
async function resolveShippingMethod(db: Db, rawKey: unknown): Promise<ShippingMethodDocument> {
  const key = typeof rawKey === "string" && rawKey.trim() ? rawKey.trim() : STANDARD_SHIPPING.key;
  const method = await db.collection<ShippingMethodDocument>("shippingMethods").findOne({ key, state: "active" });
  if (method) return method;
  if (key === STANDARD_SHIPPING.key) {
    return {
      _id: new ObjectId(),
      key: STANDARD_SHIPPING.key,
      name: "Standard delivery",
      description: "Free over $50 · otherwise $7.99",
      rateMinor: STANDARD_SHIPPING.rateMinor,
      ...(STANDARD_SHIPPING.freeOverMinor !== undefined ? { freeOverMinor: STANDARD_SHIPPING.freeOverMinor } : {}),
      etaDays: [3, 7],
      state: "active",
    };
  }
  throw new AppError(422, "SHIPPING_METHOD_INVALID", "The selected shipping method is unavailable.");
}
