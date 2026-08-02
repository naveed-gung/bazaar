import { createHash } from "node:crypto";
import { MongoServerError, ObjectId, type ClientSession } from "mongodb";
import { Router } from "express";
import { orderStates, type OrderState } from "@bazaar/shared";
import { getDb, getMongoClient } from "../database/client.js";
import { assertOrderTransition } from "../domain/order-state.js";
import { AppError } from "../errors.js";
import { asyncHandler } from "../lib/http.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/dashboard", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const [products, orders, returns, customers] = await Promise.all([db.collection("products").countDocuments(), db.collection("orders").countDocuments(), db.collection("returns").countDocuments({ state: { $nin: ["closed", "rejected"] } }), db.collection("users").countDocuments()]);
  const revenue = await db.collection("orders").aggregate([{ $match: { state: { $nin: ["cancelled", "refunded"] } } }, { $group: { _id: null, amountMinor: { $sum: "$totals.total.amountMinor" } } }]).next();
  res.json({ data: { products, orders, openReturns: returns, customers, revenue: { amountMinor: Number(revenue?.["amountMinor"] ?? 0), currency: "USD" } } });
}));

adminRouter.get("/products", asyncHandler(async (_req, res) => {
  const db = await getDb(); const products = await db.collection("products").find().sort({ updatedAt: -1 }).toArray();
  res.json({ data: products.map((item) => ({ id: item._id.toString(), slug: item.slug, name: item.name, state: item.state, priceMinor: item.priceMinor, imageUrl: item.imageUrl, revision: item.revision })) });
}));

adminRouter.post("/products", asyncHandler(async (req, res) => {
  const input = productInput(req.body); const db = await getDb(); const now = new Date();
  const duplicate = await db.collection("products").findOne({ slug: input.slug }); if (duplicate) throw new AppError(409, "SLUG_CONFLICT", "That product slug already exists.");
  const productId = new ObjectId(); const variantId = new ObjectId();
  const session = (await getMongoClient()).startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("products").insertOne({ _id: productId, ...input, rating: 0, reviewCount: 0, specs: [], revision: 1, publishedAt: input.state === "published" ? now : null, createdAt: now, updatedAt: now }, { session });
      await db.collection("variants").insertOne({ _id: variantId, productId, sku: productSku(input.slug), name: "Standard", priceMinor: input.priceMinor, options: {}, state: "active", createdAt: now, updatedAt: now }, { session });
      await db.collection("inventory").insertOne({ variantId, onHand: 0, reserved: 0, version: 1, updatedAt: now }, { session });
      await audit(db, req.principal.id, "product.create", "product", productId.toString(), req.body, session);
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new AppError(409, "PRODUCT_CONFLICT", "The product slug or generated SKU already exists.");
    throw error;
  } finally { await session.endSession(); }
  res.status(201).json({ data: { id: productId.toString(), revision: 1, ...input } });
}));

adminRouter.patch("/products/:id", asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]); const expectedRevision = Number(req.body?.revision); if (!Number.isInteger(expectedRevision)) throw new AppError(422, "REVISION_REQUIRED", "A product revision is required.");
  const allowed = ["name", "brand", "category", "categorySlug", "priceMinor", "compareAtPriceMinor", "imageUrl", "blurb", "state", "badge"];
  const unknown = Object.keys(req.body ?? {}).filter((key) => key !== "revision" && !allowed.includes(key));
  if (unknown.length) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown product fields are not allowed.");
  const update = productPatch(req.body ?? {});
  const db = await getDb();
  const session = (await getMongoClient()).startSession();
  let product: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      product = await db.collection("products").findOneAndUpdate({ _id: id, revision: expectedRevision }, { $set: { ...update, ...(update["state"] === "published" ? { publishedAt: new Date() } : {}), updatedAt: new Date() }, $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (!product) return;
      if (typeof update["priceMinor"] === "number") await db.collection("variants").updateMany({ productId: id, state: "active" }, { $set: { priceMinor: update["priceMinor"], updatedAt: new Date() } }, { session });
      await audit(db, req.principal.id, "product.update", "product", id.toString(), update, session);
    });
  } finally { await session.endSession(); }
  if (!product) { const exists = await db.collection("products").findOne({ _id: id }); throw new AppError(exists ? 409 : 404, exists ? "REVISION_CONFLICT" : "PRODUCT_NOT_FOUND", exists ? "The product changed. Refresh and retry." : "Product not found.", undefined, exists ? { currentRevision: exists.revision } : undefined); }
  res.json({ data: { id: id.toString(), revision: product["revision"], ...update } });
}));

adminRouter.post("/inventory/:variantId/adjust", asyncHandler(async (req, res) => {
  const variantId = validId(req.params["variantId"]); const delta = Number(req.body?.delta); const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : ""; const idempotencyKey = req.header("idempotency-key") ?? "";
  if (!Number.isInteger(delta) || Math.abs(delta) > 1_000_000 || delta === 0 || reason.length < 3 || reason.length > 500 || idempotencyKey.length < 8 || idempotencyKey.length > 100) throw new AppError(422, "VALIDATION_FAILED", "Bounded integer delta, reason, and Idempotency-Key are required.");
  rejectUnknown(req.body, ["delta", "reason"]);
  const fingerprint = createHash("sha256").update(`${variantId.toString()}:${delta}:${reason}`).digest("hex");
  const db = await getDb(); const session = (await getMongoClient()).startSession();
  let inventory: Record<string, unknown> | null = null; let replayed = false;
  try {
    await session.withTransaction(async () => {
      const previous = await db.collection("inventoryLedger").findOne({ idempotencyKey }, { session });
      if (previous) {
        if (previous["requestFingerprint"] !== fingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was already used for another adjustment.");
        replayed = true;
        inventory = await db.collection("inventory").findOne({ variantId }, { session });
        return;
      }
      inventory = await db.collection("inventory").findOneAndUpdate({ variantId, $expr: { $gte: [{ $add: ["$onHand", delta] }, "$reserved"] } }, { $inc: { onHand: delta, version: 1 }, $set: { updatedAt: new Date() } }, { session, returnDocument: "after" });
      if (!inventory) throw new AppError(409, "INVALID_INVENTORY_ADJUSTMENT", "Adjustment would place on-hand stock below reserved stock or the variant does not exist.");
      await db.collection("inventoryLedger").insertOne({ variantId, delta, reason, actorId: req.principal.id, idempotencyKey, requestFingerprint: fingerprint, createdAt: new Date() }, { session });
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      const previous = await db.collection("inventoryLedger").findOne({ idempotencyKey });
      if (previous?.["requestFingerprint"] !== fingerprint) throw new AppError(409, "IDEMPOTENCY_CONFLICT", "That idempotency key was already used for another adjustment.");
      replayed = true; inventory = await db.collection("inventory").findOne({ variantId });
    } else throw error;
  } finally { await session.endSession(); }
  if (!inventory) throw new AppError(409, "INVENTORY_NOT_FOUND", "Inventory could not be found.");
  res.json({ data: { variantId: variantId.toString(), onHand: inventory["onHand"], reserved: inventory["reserved"], version: inventory["version"] }, ...(replayed ? { meta: { replayed: true } } : {}) });
}));

adminRouter.get("/orders", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const orders = await db.collection("orders").find().sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: orders.map((order) => ({ id: order._id.toString(), reference: order.reference, state: order.state, total: order.totals?.total, customer: order.shipping?.email, createdAt: order.createdAt })) });
}));

adminRouter.patch("/orders/:reference/state", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["fromState", "state"]);
  const next = String(req.body?.state ?? "") as OrderState;
  const from = String(req.body?.fromState ?? "") as OrderState;
  if (!orderStates.includes(next) || !orderStates.includes(from)) throw new AppError(422, "VALIDATION_FAILED", "Valid current and next order states are required.");
  assertOrderTransition(from, next);
  const db = await getDb(); const now = new Date(); const session = (await getMongoClient()).startSession();
  let order: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      order = await db.collection("orders").findOneAndUpdate(
        { reference: req.params["reference"], state: from },
        [{ $set: { state: next, updatedAt: now, timeline: { $concatArrays: ["$timeline", [{ state: next, at: now }]] } } }],
        { session, returnDocument: "after" },
      );
      if (!order) return;
      if (from === "cancellation_requested" && next === "cancelled") {
        for (const line of order["lines"] as { variantId: string; quantity: number }[]) {
          const variantId = new ObjectId(line.variantId);
          const restored = await db.collection("inventory").updateOne({ variantId }, { $inc: { onHand: line.quantity, version: 1 }, $set: { updatedAt: now } }, { session });
          if (!restored.modifiedCount) throw new AppError(409, "INVENTORY_INCONSISTENT", "Cancelled stock could not be restored.");
          await db.collection("inventoryLedger").insertOne({ variantId, delta: line.quantity, reason: "approved_cancellation", reference: order["reference"], idempotencyKey: `admin-cancel:${order["_id"]}:${line.variantId}`, actorId: req.principal.id, createdAt: now }, { session });
        }
      }
      await audit(db, req.principal.id, "order.transition", "order", String(order["_id"]), { from, to: next }, session);
    });
  } finally { await session.endSession(); }
  if (!order) throw new AppError(409, "ORDER_STATE_CONFLICT", "The order state changed. Refresh and retry.");
  res.json({ data: { reference: order["reference"], state: order["state"] } });
}));

adminRouter.get("/returns", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const returns = await db.collection("returns").find().sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: returns.map((item) => ({ id: item._id.toString(), reference: item.reference, state: item.state, reason: item.reason, resolution: item.resolution, createdAt: item.createdAt })) });
}));

adminRouter.patch("/returns/:id/state", asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const state = String(req.body?.state ?? "");
  const fromState = String(req.body?.fromState ?? "");
  const allowed: Record<string, string[]> = { requested: ["approved", "rejected"], approved: ["in_transit", "received"], in_transit: ["received"], received: ["refunded", "replacement_sent", "closed"], refunded: ["closed"], replacement_sent: ["closed"], rejected: ["closed"] };
  if (!allowed[fromState]?.includes(state)) throw new AppError(409, "INVALID_RETURN_TRANSITION", `Return cannot move from ${fromState} to ${state}.`);
  const db = await getDb();
  const session = (await getMongoClient()).startSession();
  let item: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      item = await db.collection("returns").findOneAndUpdate({ _id: id, state: fromState }, { $set: { state, updatedAt: new Date() }, ...(["rejected", "closed"].includes(state) ? { $unset: { activeOrderId: "" } } : {}) }, { session, returnDocument: "after" });
      if (!item) throw new AppError(409, "RETURN_STATE_CONFLICT", "The return state changed. Refresh and retry.");
      const orderMove: Record<string, { from: OrderState; to: OrderState }> = {
        approved: { from: "return_requested", to: "return_approved" },
        rejected: { from: "return_requested", to: "return_rejected" },
        received: { from: "return_approved", to: "returned" },
        refunded: { from: "returned", to: "refunded" },
        "rejected:closed": { from: "return_rejected", to: "delivered" },
        "refunded:closed": { from: "refunded", to: "closed" },
        "replacement_sent:closed": { from: "returned", to: "closed" },
      };
      const move = orderMove[`${fromState}:${state}`] ?? orderMove[state];
      if (move) {
        const now = new Date();
        const economicUpdate = state === "refunded" ? { payment: { $mergeObjects: ["$payment", { status: "refunded" }] }, refund: { method: "simulator", status: "confirmed", amount: "$totals.total", at: now } } : {};
        const changed = await db.collection("orders").updateOne(
          { _id: item["orderId"] as ObjectId, state: move.from },
          [{ $set: { state: move.to, ...economicUpdate, updatedAt: now, timeline: { $concatArrays: ["$timeline", [{ state: move.to, at: now }]] } } }],
          { session },
        );
        if (!changed.modifiedCount) throw new AppError(409, "ORDER_STATE_CONFLICT", "The linked order state changed. Refresh and retry.");
      }
    });
  } finally {
    await session.endSession();
  }
  if (!item) throw new AppError(500, "RETURN_UPDATE_FAILED", "The return could not be updated.");
  await audit(db, req.principal.id, "return.transition", "return", id.toString(), { from: fromState, to: state });
  res.json({ data: { id: id.toString(), state } });
}));

adminRouter.get("/reviews", asyncHandler(async (req, res) => {
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "pending";
  const db = await getDb();
  const reviews = await db.collection("reviews").find({ state }).sort({ createdAt: 1 }).limit(100).toArray();
  res.json({ data: reviews.map((item) => ({ id: item._id.toString(), productId: item.productId.toString(), rating: item.rating, title: item.title, body: item.body, verified: item.verified, state: item.state, createdAt: item.createdAt })) });
}));

adminRouter.patch("/reviews/:id/state", asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const state = String(req.body?.state ?? "");
  if (!["published", "rejected"].includes(state)) throw new AppError(422, "VALIDATION_FAILED", "Review state must be published or rejected.");
  const db = await getDb();
  const review = await db.collection("reviews").findOneAndUpdate({ _id: id, state: "pending" }, { $set: { state, moderatedAt: new Date(), moderatedBy: req.principal.id } }, { returnDocument: "after" });
  if (!review) throw new AppError(409, "REVIEW_STATE_CONFLICT", "The review was already moderated.");
  if (state === "published") {
    const summary = await db.collection("reviews").aggregate([{ $match: { productId: review.productId, state: "published" } }, { $group: { _id: "$productId", rating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }]).next();
    await db.collection("products").updateOne({ _id: review.productId }, { $set: { rating: Number(summary?.["rating"] ?? 0), reviewCount: Number(summary?.["reviewCount"] ?? 0), updatedAt: new Date() } });
  }
  await audit(db, req.principal.id, `review.${state}`, "review", id.toString(), { state });
  res.json({ data: { id: id.toString(), state } });
}));

adminRouter.get("/customers", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const customers = await db.collection("users").find({}, { projection: { email: 1, displayName: 1, roles: 1, createdAt: 1, updatedAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: customers.map((item) => ({ id: item._id.toString(), email: item.email, displayName: item.displayName, roles: item.roles, createdAt: item.createdAt })) });
}));

adminRouter.get("/audits", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const logs = await db.collection("auditLogs").find({ smokeId: { $exists: false } }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: logs.map((item) => ({ id: item._id.toString(), actorId: item.actorId, action: item.action, entityType: item.entityType, entityId: item.entityId, createdAt: item.createdAt })) });
}));

function validId(value: unknown) { const id = String(value ?? ""); if (!ObjectId.isValid(id)) throw new AppError(422, "VALIDATION_FAILED", "Invalid identifier."); return new ObjectId(id); }
function productInput(body: Record<string, unknown> | undefined) {
  const allowed = new Set(["slug", "name", "brand", "category", "categorySlug", "priceMinor", "imageUrl", "blurb", "state"]);
  if (Object.keys(body ?? {}).some((key) => !allowed.has(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown product fields are not allowed.");
  const string = (key: string) => typeof body?.[key] === "string" ? body[key].trim() : "";
  const input = { slug: string("slug").toLowerCase(), name: string("name"), brand: string("brand"), category: string("category"), categorySlug: string("categorySlug"), priceMinor: Number(body?.["priceMinor"]), imageUrl: string("imageUrl"), blurb: string("blurb"), state: string("state") || "draft" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) || input.name.length < 2 || input.name.length > 160 || input.brand.length < 2 || input.brand.length > 80 || input.category.length < 2 || input.category.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.categorySlug) || !Number.isInteger(input.priceMinor) || input.priceMinor < 0 || input.priceMinor > 100_000_000 || !safeMediaUrl(input.imageUrl) || input.blurb.length < 10 || input.blurb.length > 2_000 || !["draft", "published", "archived"].includes(input.state)) throw new AppError(422, "VALIDATION_FAILED", "Complete valid product details are required.");
  return input;
}
function productPatch(body: Record<string, unknown>) {
  const update = Object.fromEntries(Object.entries(body).filter(([key, value]) => key !== "revision" && value !== undefined));
  const boundedText: Record<string, [number, number]> = { name: [2, 160], brand: [2, 80], category: [2, 80], blurb: [10, 2_000] };
  for (const [key, [min, max]] of Object.entries(boundedText)) {
    if (!(key in update)) continue;
    if (typeof update[key] !== "string") throw new AppError(422, "VALIDATION_FAILED", `${key} must be text.`);
    update[key] = update[key].trim();
    if ((update[key] as string).length < min || (update[key] as string).length > max) throw new AppError(422, "VALIDATION_FAILED", `${key} must be between ${min} and ${max} characters.`);
  }
  if ("categorySlug" in update && (typeof update["categorySlug"] !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(update["categorySlug"]))) throw new AppError(422, "VALIDATION_FAILED", "Category slug is invalid.");
  for (const key of ["priceMinor", "compareAtPriceMinor"]) if (key in update && (!Number.isInteger(update[key]) || Number(update[key]) < 0 || Number(update[key]) > 100_000_000)) throw new AppError(422, "VALIDATION_FAILED", `${key} must be a valid minor-unit price.`);
  if (typeof update["priceMinor"] === "number" && typeof update["compareAtPriceMinor"] === "number" && update["compareAtPriceMinor"] < update["priceMinor"]) throw new AppError(422, "VALIDATION_FAILED", "Compare-at price cannot be below the sale price.");
  if ("imageUrl" in update && (typeof update["imageUrl"] !== "string" || !safeMediaUrl(update["imageUrl"]))) throw new AppError(422, "MEDIA_URL_INVALID", "Use repository catalog media or Bazaar-managed media.");
  if ("state" in update && (typeof update["state"] !== "string" || !["draft", "published", "archived"].includes(update["state"]))) throw new AppError(422, "VALIDATION_FAILED", "Product state is invalid.");
  if ("badge" in update && update["badge"] !== null && update["badge"] !== "New" && update["badge"] !== "Deal") throw new AppError(422, "VALIDATION_FAILED", "Product badge is invalid.");
  if (!Object.keys(update).length) throw new AppError(422, "VALIDATION_FAILED", "At least one product change is required.");
  return update;
}
function productSku(slug: string) { return `BZ-${createHash("sha256").update(slug).digest("hex").slice(0, 12).toUpperCase()}`; }
function safeMediaUrl(value: string) { return value.length <= 500 && (/^\/catalog\/[a-zA-Z0-9._-]+$/.test(value) || /^\/api\/v1\/media\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(value)); }
function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) { if (Object.keys(body ?? {}).some((key) => !allowed.includes(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown fields are not allowed."); }
async function audit(db: Awaited<ReturnType<typeof getDb>>, actorId: string, action: string, entityType: string, entityId: string, changes: unknown, session?: ClientSession) { await db.collection("auditLogs").insertOne({ actorId, action, entityType, entityId, changes, createdAt: new Date() }, session ? { session } : undefined); }
