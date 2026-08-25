import { createHash } from "node:crypto";
import { MongoServerError, ObjectId, type ClientSession } from "mongodb";
import { Router } from "express";
import { orderStates, type OrderState, type ProductImage, type ProductOption } from "@bazaar/shared";
import { getDb, getMongoClient } from "../database/client.js";
import { assertOrderTransition } from "../domain/order-state.js";
import { availabilityOf } from "../domain/catalog.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { requirePermission, requireUser } from "../middleware/auth.js";

export const adminRouter = Router();
// Authentication-only router guard; the specific permission check lives on each handler
// below so roles like `support` can reach their endpoints without holding the whole matrix.
adminRouter.use(requireUser);

adminRouter.get("/dashboard", requirePermission("analytics:read"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const [products, orders, returns, customers] = await Promise.all([db.collection("products").countDocuments(), db.collection("orders").countDocuments(), db.collection("returns").countDocuments({ state: { $nin: ["closed", "rejected"] } }), db.collection("users").countDocuments()]);
  const revenue = await db.collection("orders").aggregate([{ $match: { state: { $nin: ["cancelled", "refunded"] } } }, { $group: { _id: null, amountMinor: { $sum: "$totals.total.amountMinor" } } }]).next();
  res.json({ data: { products, orders, openReturns: returns, customers, revenue: { amountMinor: Number(revenue?.["amountMinor"] ?? 0), currency: "USD" } } });
}));

adminRouter.get("/products", requirePermission("catalog:read"), asyncHandler(async (_req, res) => {
  const db = await getDb(); const products = await db.collection("products").find().sort({ updatedAt: -1 }).toArray();
  res.json({ data: products.map((item) => ({ id: item._id.toString(), slug: item.slug, name: item.name, state: item.state, priceMinor: item.priceMinor, imageUrl: item.imageUrl, revision: item.revision })) });
}));

adminRouter.post("/products", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const input = productInput(req.body);
  const extras = productExtras(req.body, input.slug, input.priceMinor); // API-07: specs/images/options/variants
  const db = await getDb(); const now = new Date();
  const duplicate = await db.collection("products").findOne({ slug: input.slug }); if (duplicate) throw new AppError(409, "SLUG_CONFLICT", "That product slug already exists.");
  const productId = new ObjectId();
  // No explicit variants keeps the legacy single "Standard" variant; explicit ones each get
  // their inventory document in the SAME transaction (reserved starts at 0).
  const variantDocs = (extras.variants ?? [{ sku: productSku(input.slug), name: "Standard", options: {}, priceMinor: input.priceMinor, imageIndex: 0, onHand: 0 }]).map((seed) => ({ seed, _id: new ObjectId() }));
  const session = (await getMongoClient()).startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("products").insertOne({ _id: productId, ...input, rating: 0, reviewCount: 0, specs: extras.specs, ...(extras.images.length ? { images: extras.images } : {}), ...(extras.options.length ? { options: extras.options } : {}), revision: 1, publishedAt: input.state === "published" ? now : null, createdAt: now, updatedAt: now }, { session });
      for (const { seed, _id } of variantDocs) {
        await db.collection("variants").insertOne({ _id, productId, sku: seed.sku, name: seed.name, options: seed.options, priceMinor: seed.priceMinor, ...(seed.compareAtPriceMinor !== undefined ? { compareAtPriceMinor: seed.compareAtPriceMinor } : {}), imageIndex: seed.imageIndex, state: "active", createdAt: now, updatedAt: now }, { session });
        await db.collection("inventory").insertOne({ variantId: _id, onHand: seed.onHand, reserved: 0, version: 1, updatedAt: now }, { session });
      }
      await audit(db, req.principal.id, "product.create", "product", productId.toString(), req.body, session);
    });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new AppError(409, "PRODUCT_CONFLICT", "The product slug or a generated SKU already exists.");
    throw error;
  } finally { await session.endSession(); }
  await recomputeProductRating(db, productId); // API-07: same aggregation as moderation — never hardcoded
  res.status(201).json({ data: { id: productId.toString(), revision: 1, ...input, variants: variantDocs.map(({ seed, _id }) => ({ id: _id.toString(), sku: seed.sku })) } });
}));

adminRouter.patch("/products/:id", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]); const expectedRevision = Number(req.body?.revision); if (!Number.isInteger(expectedRevision)) throw new AppError(422, "REVISION_REQUIRED", "A product revision is required.");
  // API-07 widens the editor: scalar fields as before, plus specs/images/options replacement
  // arrays and a variants operation envelope ({ add, update, archive }).
  const allowed = ["name", "brand", "category", "categorySlug", "priceMinor", "compareAtPriceMinor", "imageUrl", "blurb", "state", "badge", "specs", "images", "options", "variants"];
  const unknown = Object.keys(req.body ?? {}).filter((key) => key !== "revision" && !allowed.includes(key));
  if (unknown.length) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown product fields are not allowed.");
  const scalars = { ...(req.body ?? {}) } as Record<string, unknown>;
  const specsInput = scalars["specs"]; const imagesInput = scalars["images"]; const optionsInput = scalars["options"]; const variantsInput = scalars["variants"];
  delete scalars["specs"]; delete scalars["images"]; delete scalars["options"]; delete scalars["variants"];
  // Editor-array-only patches carry no scalar keys; skip productPatch so its "at least one
  // change" guard does not reject them.
  const update = Object.keys(scalars).some((key) => key !== "revision") ? productPatch(scalars) : {};
  const nextSpecs = specsInput === undefined ? null : parseSpecs(specsInput);
  const nextImages = imagesInput === undefined ? null : parseImages(imagesInput);
  const nextOptions = optionsInput === undefined ? null : parseOptions(optionsInput);
  const variantOps = parseVariantOps(variantsInput);
  const db = await getDb();
  const session = (await getMongoClient()).startSession();
  let product: Record<string, unknown> | null = null;
  let variantReport = { added: 0, updated: 0, archived: 0 };
  try {
    await session.withTransaction(async () => {
      const before = await db.collection("products").findOne({ _id: id }, { session });
      if (!before) return;
      const effectiveOptions = nextOptions ?? ((before["options"] ?? []) as ProductOption[]);
      const effectiveImageCount = nextImages ? nextImages.length : (Array.isArray(before["images"]) ? before["images"].length : 0);
      if (nextOptions) {
        const activeVariants = await db.collection("variants").find({ productId: id, state: "active" }, { session }).toArray();
        for (const variant of activeVariants) {
          if (!optionValuesMatch(effectiveOptions, (variant["options"] ?? {}) as Record<string, unknown>)) throw new AppError(422, "OPTION_VARIANT_MISMATCH", "An existing variant does not match the new option set. Update or archive the product's variants first.");
        }
      }
      product = await db.collection("products").findOneAndUpdate({ _id: id, revision: expectedRevision }, { $set: { ...update, ...(nextSpecs ? { specs: nextSpecs } : {}), ...(nextImages ? { images: nextImages } : {}), ...(nextOptions ? { options: nextOptions } : {}), ...(update["state"] === "published" ? { publishedAt: new Date() } : {}), updatedAt: new Date() }, $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (!product) return;
      // Price cascade only when EVERY active variant still tracks the previous base price
      // (legacy single-"Standard" products). Seeded multi-price variant ranges keep their spread.
      if (typeof update["priceMinor"] === "number") {
        const actives = await db.collection("variants").find({ productId: id, state: "active" }, { session }).toArray();
        if (actives.length && actives.every((variant) => Number(variant["priceMinor"]) === Number(before["priceMinor"]))) await db.collection("variants").updateMany({ productId: id, state: "active" }, { $set: { priceMinor: update["priceMinor"], updatedAt: new Date() } }, { session });
      }
      variantReport = await applyVariantOps(db, id, variantOps, effectiveOptions, effectiveImageCount, Number(update["priceMinor"] ?? before["priceMinor"]), String(before["slug"]), session);
      await audit(db, req.principal.id, "product.update", "product", id.toString(), { ...update, ...(nextSpecs ? { specsReplaced: nextSpecs.length } : {}), ...(nextImages ? { imagesReplaced: nextImages.length } : {}), ...(nextOptions ? { optionsReplaced: nextOptions.length } : {}), ...(variantOps ? { variants: variantReport } : {}) }, session);
    });
  } finally { await session.endSession(); }
  if (!product) { const exists = await db.collection("products").findOne({ _id: id }); throw new AppError(exists ? 409 : 404, exists ? "REVISION_CONFLICT" : "PRODUCT_NOT_FOUND", exists ? "The product changed. Refresh and retry." : "Product not found.", undefined, exists ? { currentRevision: exists.revision } : undefined); }
  await recomputeProductRating(db, id); // API-07: rating/reviewCount re-derived after mutation, never hardcoded
  res.json({ data: { id: id.toString(), revision: product["revision"], ...update, ...(variantReport.added || variantReport.updated || variantReport.archived ? { variants: variantReport } : {}) } });
}));

// API-07: full editable product detail — every variant with its live stock for the editor.
adminRouter.get("/products/:id", requirePermission("catalog:read"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const db = await getDb();
  const product = await db.collection("products").findOne({ _id: id });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const variants = await db.collection("variants").find({ productId: id }).sort({ createdAt: 1, _id: 1 }).toArray();
  const inventory = await db.collection("inventory").find({ variantId: { $in: variants.map((variant) => variant._id) } }).toArray();
  const stockByVariant = new Map(inventory.map((row) => [String(row["variantId"]), row]));
  res.json({ data: {
    id: id.toString(), slug: product.slug, name: product.name, brand: product.brand, category: product.category, categorySlug: product.categorySlug,
    priceMinor: product.priceMinor, compareAtPriceMinor: product.compareAtPriceMinor ?? null, imageUrl: product.imageUrl,
    images: Array.isArray(product.images) ? product.images : [], options: Array.isArray(product.options) ? product.options : [],
    specs: Array.isArray(product.specs) ? product.specs : [], badge: product.badge ?? null, blurb: product.blurb, state: product.state,
    publishedAt: product.publishedAt, revision: product.revision, rating: product.rating, reviewCount: product.reviewCount, createdAt: product.createdAt, updatedAt: product.updatedAt,
    variants: variants.map((variant) => {
      const stock = stockByVariant.get(String(variant._id));
      const onHand = Number(stock?.["onHand"] ?? 0); const reserved = Number(stock?.["reserved"] ?? 0);
      const sellable = Math.max(0, onHand - reserved);
      return { id: variant._id.toString(), sku: variant.sku, name: variant.name, options: (variant.options ?? {}) as Record<string, string>, priceMinor: Number(variant.priceMinor), compareAtPriceMinor: variant.compareAtPriceMinor ?? null, imageIndex: Number(variant.imageIndex ?? 0), state: variant.state, onHand, reserved, sellable, availability: availabilityOf(sellable), stockVersion: Number(stock?.["version"] ?? 0) };
    }),
  } });
}));

// API-07: ARCHIVE-not-delete. Historical order lines reference product ids forever.
adminRouter.delete("/products/:id", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const db = await getDb(); const now = new Date();
  const session = (await getMongoClient()).startSession();
  let product: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      product = await db.collection("products").findOneAndUpdate({ _id: id, state: { $ne: "archived" } }, { $set: { state: "archived", updatedAt: now }, $inc: { revision: 1 } }, { session, returnDocument: "after" });
      if (!product) return;
      await audit(db, req.principal.id, "product.archive", "product", id.toString(), { state: "archived" }, session);
    });
  } finally { await session.endSession(); }
  if (!product) {
    const existing = await db.collection("products").findOne({ _id: id }, { projection: { state: 1, revision: 1 } });
    if (!existing) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    res.json({ data: { id: id.toString(), state: existing["state"], revision: existing["revision"], alreadyArchived: true } }); return;
  }
  res.json({ data: { id: id.toString(), state: "archived", revision: product["revision"] } });
}));

// API-07: ARCHIVE-not-delete for variants — historical order lines keep resolving, and the
// inventory document (including any live reservations) is deliberately left untouched.
adminRouter.delete("/products/:id/variants/:variantId", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]); const variantId = validId(req.params["variantId"]);
  const db = await getDb(); const now = new Date();
  const session = (await getMongoClient()).startSession();
  let variant: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      variant = await db.collection("variants").findOneAndUpdate({ _id: variantId, productId: id, state: "active" }, { $set: { state: "archived", updatedAt: now } }, { session, returnDocument: "after" });
      if (!variant) return;
      await db.collection("products").updateOne({ _id: id }, { $set: { updatedAt: now }, $inc: { revision: 1 } }, { session });
      await audit(db, req.principal.id, "variant.archive", "variant", variantId.toString(), { productId: id.toString() }, session);
    });
  } finally { await session.endSession(); }
  if (!variant) {
    const existing = await db.collection("variants").findOne({ _id: variantId, productId: id }, { projection: { state: 1 } });
    if (!existing) throw new AppError(404, "VARIANT_NOT_FOUND", "Variant not found for this product.");
    res.json({ data: { id: variantId.toString(), productId: id.toString(), state: existing["state"], alreadyArchived: true } }); return;
  }
  res.json({ data: { id: variantId.toString(), productId: id.toString(), state: "archived" } });
}));

adminRouter.post("/inventory/:variantId/adjust", requirePermission("inventory:manage"), asyncHandler(async (req, res) => {
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
      // API-05 restock resolution: an adjustment lifting onHand from ≤ 0 to positive resolves
      // this variant's active alerts. Audit-only by design — no delivery mechanism exists.
      if (delta > 0) {
        const previousOnHand = Number(inventory["onHand"]) - delta;
        if (previousOnHand <= 0) {
          const resolved = await db.collection("stockAlerts").updateMany({ variantId, state: "active" }, { $set: { state: "resolved", resolvedAt: new Date() } }, { session });
          if (resolved.modifiedCount) await db.collection("auditLogs").insertOne({ actorId: req.principal.id, action: "stockAlert.resolved", entityType: "variant", entityId: variantId.toString(), changes: { resolvedCount: resolved.modifiedCount, trigger: "restock" }, createdAt: new Date() }, { session });
        }
      }
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

// API-05: stock-alert registration. Customer self-service on the caller's OWN alert, so it
// carries the router-wide requireUser only — no permission from the admin map applies
// (customers hold none by design). Path deviation from the documented
// `POST /products/:slug/stock-alert`: this wave's file ownership confines the handler to
// admin.ts, which mounts at /admin. Idempotent per (product, ownerKey) via the unique index.
adminRouter.post("/products/:slug/stock-alert", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["variantId", "email"]);
  const slug = String(req.params["slug"] ?? "").toLowerCase();
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(422, "VALIDATION_FAILED", "A valid email address is required.");
  const db = await getDb();
  const product = await db.collection("products").findOne({ slug, state: "published" }, { projection: { _id: 1 } });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const variantId = validId(req.body?.variantId);
  const variant = await db.collection("variants").findOne({ _id: variantId, productId: product._id, state: "active" }, { projection: { _id: 1 } });
  if (!variant) throw new AppError(404, "VARIANT_NOT_FOUND", "Variant not found for this product.");
  const stock = await db.collection("inventory").findOne({ variantId }, { projection: { onHand: 1, reserved: 1 } });
  if (stock && Number(stock["onHand"]) - Number(stock["reserved"]) > 0) throw new AppError(409, "ITEM_IN_STOCK", "The item is in stock — no alert needed.");
  const key = ownerKey(req);
  const existing = await db.collection("stockAlerts").findOne({ productId: product._id, ownerKey: key }, { projection: { _id: 1 } });
  const now = new Date();
  let alert: Record<string, unknown> | null = null;
  try {
    alert = await db.collection("stockAlerts").findOneAndUpdate(
      { productId: product._id, ownerKey: key },
      { $set: { variantId, ...(email ? { email } : {}), state: "active", updatedAt: now }, $setOnInsert: { productId: product._id, ownerKey: key, createdAt: now } },
      { upsert: true, returnDocument: "after" },
    );
  } catch (error) {
    // A concurrent duplicate loses the upsert race to the unique index; re-read and answer
    // idempotently instead of failing.
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
    alert = await db.collection("stockAlerts").findOne({ productId: product._id, ownerKey: key });
  }
  if (!alert) throw new AppError(500, "STOCK_ALERT_FAILED", "The stock alert could not be registered.");
  // Audit WITHOUT the email address — it is personal data and must not reach the log.
  await audit(db, req.principal.id, "stockAlert.register", "product", product._id.toString(), { variantId: variantId.toString(), alertId: String(alert["_id"]) });
  res.status(existing ? 200 : 201).json({
    data: { id: String(alert["_id"]), productId: product._id.toString(), variantId: variantId.toString(), state: alert["state"], createdAt: alert["createdAt"] },
    meta: { delivery: "none", note: "Notifications are out of scope (API-05): restock resolution is recorded in auditLogs only.", ...(existing ? { replayed: true } : {}) },
  });
}));

// ---------------------------------------------------------------- API-08: promotions CRUD
// Behind promos:manage — the permission ALREADY exists in packages/shared permissions.ts
// (PERMISSIONS list + owner/ops SYSTEM_ROLES), so no RBAC extension was needed. The document
// shape is PINNED to what activePromotion() consumes; the checkout lookup in routes/orders.ts
// is reused UNCHANGED: findOne({ code, state: "active", startsAt <= now < endsAt }).
adminRouter.get("/promotions", requirePermission("promos:manage"), asyncHandler(async (req, res) => {
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "";
  if (state && !["active", "archived"].includes(state)) throw new AppError(422, "VALIDATION_FAILED", "Promotion state filter must be active or archived.");
  const db = await getDb();
  const promotions = await db.collection("promotions").find(state ? { state } : {}).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: promotions.map((promotion) => serializePromotion(promotion)) });
}));

adminRouter.post("/promotions", requirePermission("promos:manage"), asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["code", "name", "percentOff", "maxDiscountMinor", "startsAt", "endsAt"]);
  const input = promotionInput(req.body, null);
  const db = await getDb(); const now = new Date();
  const session = (await getMongoClient()).startSession();
  let created: Record<string, unknown> | null = null;
  try {
    await session.withTransaction(async () => {
      const result = await db.collection("promotions").insertOne({ ...input, createdAt: now, updatedAt: now }, { session });
      created = { _id: result.insertedId, ...input, createdAt: now, updatedAt: now };
      await audit(db, req.principal.id, "promotion.create", "promotion", result.insertedId.toString(), { code: input.code, percentOff: input.percentOff }, session);
    });
  } catch (error) {
    // The sparse unique index on code surfaces duplicates as 409, never 500.
    if (error instanceof MongoServerError && error.code === 11000) throw new AppError(409, "PROMO_CODE_CONFLICT", "A promotion with that code already exists.");
    throw error;
  } finally { await session.endSession(); }
  if (!created) throw new AppError(500, "PROMOTION_FAILED", "The promotion could not be created.");
  res.status(201).json({ data: serializePromotion(created) });
}));

adminRouter.patch("/promotions/:id", requirePermission("promos:manage"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  rejectUnknown(req.body, ["name", "percentOff", "maxDiscountMinor", "startsAt", "endsAt", "state"]);
  const db = await getDb();
  const current = await db.collection("promotions").findOne({ _id: id });
  if (!current) throw new AppError(404, "PROMOTION_NOT_FOUND", "Promotion not found.");
  const merged = promotionInput({ ...current, ...req.body }, current);
  const clearMax = req.body?.maxDiscountMinor === null;
  const updated = await db.collection("promotions").findOneAndUpdate(
    { _id: id },
    { $set: { name: merged.name, percentOff: merged.percentOff, startsAt: merged.startsAt, endsAt: merged.endsAt, state: merged.state, ...(merged.maxDiscountMinor !== undefined ? { maxDiscountMinor: merged.maxDiscountMinor } : {}), updatedAt: new Date() }, ...(clearMax ? { $unset: { maxDiscountMinor: "" } } : {}) },
    { returnDocument: "after" },
  );
  await audit(db, req.principal.id, "promotion.update", "promotion", id.toString(), { code: current.code, changes: req.body });
  if (!updated) throw new AppError(500, "PROMOTION_UPDATE_FAILED", "The promotion could not be updated.");
  res.json({ data: serializePromotion(updated) });
}));

// ARCHIVE-not-delete: historical orders reference the promotion code.
adminRouter.delete("/promotions/:id", requirePermission("promos:manage"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const db = await getDb();
  const archived = await db.collection("promotions").findOneAndUpdate({ _id: id, state: { $ne: "archived" } }, { $set: { state: "archived", updatedAt: new Date() } }, { returnDocument: "after" });
  if (!archived) {
    const exists = await db.collection("promotions").findOne({ _id: id }, { projection: { state: 1 } });
    if (!exists) throw new AppError(404, "PROMOTION_NOT_FOUND", "Promotion not found.");
    res.json({ data: { id: id.toString(), state: exists["state"], alreadyArchived: true } }); return;
  }
  await audit(db, req.principal.id, "promotion.archive", "promotion", id.toString(), { code: archived["code"], state: "archived" });
  res.json({ data: { id: id.toString(), state: "archived" } });
}));

// ---------------------------------------------------------------- API-09: categories CRUD
// List behind catalog:read, mutations behind catalog:write. Slug is IMMUTABLE — products
// store categorySlug, so renaming a slug would orphan them; rename the display name instead.
adminRouter.get("/categories", requirePermission("catalog:read"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const categories = await db.collection("categories").find().sort({ name: 1 }).limit(200).toArray();
  res.json({ data: categories.map((category) => serializeCategory(category)) });
}));

adminRouter.post("/categories", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["slug", "name", "blurb", "icon"]);
  const category = categoryInput(req.body, null);
  const db = await getDb(); const now = new Date();
  try {
    const result = await db.collection("categories").insertOne({ ...category, createdAt: now, updatedAt: now });
    await audit(db, req.principal.id, "category.create", "category", result.insertedId.toString(), { slug: category.slug });
    res.status(201).json({ data: serializeCategory({ _id: result.insertedId, ...category, createdAt: now, updatedAt: now }) });
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) throw new AppError(409, "SLUG_CONFLICT", "A category with that slug already exists.");
    throw error;
  }
}));

adminRouter.patch("/categories/:id", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  rejectUnknown(req.body, ["name", "blurb", "icon", "state"]);
  const db = await getDb();
  const current = await db.collection("categories").findOne({ _id: id });
  if (!current) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  const merged = categoryInput({ ...current, ...req.body }, current);
  const updated = await db.collection("categories").findOneAndUpdate({ _id: id }, { $set: { ...merged, updatedAt: new Date() } }, { returnDocument: "after" });
  await audit(db, req.principal.id, "category.update", "category", id.toString(), { slug: current.slug, changes: req.body });
  res.json({ data: serializeCategory(updated) });
}));

adminRouter.delete("/categories/:id", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const id = validId(req.params["id"]);
  const db = await getDb();
  const category = await db.collection("categories").findOne({ _id: id });
  if (!category) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
  // Delete guard: a category still referenced by products refuses to go, naming the count.
  const productCount = await db.collection("products").countDocuments({ categorySlug: category.slug });
  if (productCount > 0) throw new AppError(409, "CATEGORY_IN_USE", "Products still reference this category.", undefined, { productCount });
  await db.collection("categories").deleteOne({ _id: id });
  await audit(db, req.principal.id, "category.delete", "category", id.toString(), { slug: category.slug });
  res.status(204).send();
}));

// ---------------------------------------------------------------- API-10: order detail + invoice
adminRouter.get("/orders/:reference", requirePermission("orders:read"), asyncHandler(async (req, res) => {
  const db = await getDb();
  const order = await db.collection("orders").findOne({ reference: req.params["reference"] });
  if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  const linkedReturns = await db.collection("returns").find({ orderId: order._id }).sort({ createdAt: -1 }).project({ reference: 1, state: 1, reason: 1, resolution: 1, createdAt: 1 }).toArray();
  res.json({ data: { id: order._id.toString(), reference: order.reference, state: order.state, payment: order.payment, shipping: order.shipping, shippingMethod: order.shippingMethod ?? "standard", promotionCode: order.promotionCode ?? null, lines: order.lines, totals: order.totals, timeline: order.timeline ?? [], returns: linkedReturns, createdAt: order.createdAt, updatedAt: order.updatedAt } });
}));

// Printable invoice built ONLY from the stored order snapshots — never re-priced from the
// live catalogue, so historical invoices never change when prices do. Access: orders:read
// holders OR the order's owner; anyone else gets the SAME 404 as a missing order so order
// existence is never leaked.
adminRouter.get("/orders/:reference/invoice", asyncHandler(async (req, res) => {
  const db = await getDb();
  const order = await db.collection("orders").findOne({ reference: req.params["reference"] });
  const permitted = req.principal.permissions.includes("orders:read");
  const owned = order !== null && order["ownerKey"] === ownerKey(req);
  if (order === null || (!permitted && !owned)) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
  res.json({ data: {
    reference: order.reference,
    issuedAt: new Date().toISOString(),
    orderCreatedAt: order.createdAt,
    state: order.state,
    seller: { name: "Bazaar", note: "Demo storefront — invoices are generated for illustration." },
    billTo: order.shipping,
    lines: (Array.isArray(order.lines) ? order.lines : []).map((line: Record<string, unknown>) => ({ name: line["name"], slug: line["slug"], quantity: line["quantity"], unitPrice: line["unitPrice"], lineTotal: line["lineTotal"] })),
    subtotal: order.totals?.subtotal ?? null, discount: order.totals?.discount ?? null, shipping: order.totals?.shipping ?? null, tax: order.totals?.tax ?? null, total: order.totals?.total ?? null,
    promotionCode: order.promotionCode ?? null,
    payment: { method: order.payment?.method ?? "simulator", status: order.payment?.status ?? "confirmed", simulated: true, disclosure: "This is a simulated payment. No card was charged." },
    shippingMethod: order.shippingMethod ?? "standard",
  } });
}));

// ---------------------------------------------------------------- API-11: analytics
// REVENUE DEFINITION (also recorded in docs/agent/07-backend-api.md): revenue counts every
// order whose state represents captured money — all 19 states EXCEPT awaiting_payment (never
// captured), payment_failed, cancelled and refunded. partially_refunded still counts at its
// full original total because partial amounts are not tracked; refunded money is reported
// separately. Timestamps are the order's createdAt (UTC); money is minor units (USD).
const NON_REVENUE_STATES = ["awaiting_payment", "payment_failed", "cancelled", "refunded"];

adminRouter.get("/analytics", requirePermission("analytics:read"), asyncHandler(async (req, res) => {
  const rawBucket = typeof req.query["bucket"] === "string" ? req.query["bucket"] : "daily";
  if (!["daily", "weekly", "monthly"].includes(rawBucket)) throw new AppError(422, "VALIDATION_FAILED", "bucket must be daily, weekly or monthly.");
  const to = req.query["to"] === undefined ? new Date() : parseDateQuery(req.query["to"]);
  const from = req.query["from"] === undefined ? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000) : parseDateQuery(req.query["from"]);
  if (from.getTime() >= to.getTime()) throw new AppError(422, "VALIDATION_FAILED", "from must come before to.");
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) throw new AppError(422, "RANGE_TOO_LONG", "The analytics range is capped at 366 days.");
  const range = { $gte: from, $lte: to };
  const revenueStates = { $nin: NON_REVENUE_STATES };
  const unit = rawBucket === "weekly" ? "week" : rawBucket === "monthly" ? "month" : "day";
  const db = await getDb();

  // One bounded aggregation per section — every order query is pinned to the date range.
  const [revenueRows, refundedRow, stateRows, topRows] = await Promise.all([
    db.collection("orders").aggregate([
      { $match: { createdAt: range, state: revenueStates } },
      { $group: { _id: { $dateTrunc: { date: "$createdAt", unit } }, amountMinor: { $sum: "$totals.total.amountMinor" }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection("orders").aggregate([
      { $match: { createdAt: range, state: { $in: ["refunded", "partially_refunded"] } } },
      { $group: { _id: null, amountMinor: { $sum: "$totals.total.amountMinor" }, orders: { $sum: 1 } } },
    ]).next(),
    db.collection("orders").aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: "$state", orders: { $sum: 1 }, amountMinor: { $sum: "$totals.total.amountMinor" } } },
      { $sort: { orders: -1 } },
    ]).toArray(),
    db.collection("orders").aggregate([
      { $match: { createdAt: range, state: revenueStates } },
      { $unwind: "$lines" },
      { $group: { _id: { productId: "$lines.productId", slug: "$lines.slug", name: "$lines.name" }, units: { $sum: "$lines.quantity" }, amountMinor: { $sum: "$lines.lineTotal.amountMinor" } } },
      { $sort: { amountMinor: -1 } },
      { $limit: 50 },
    ]).toArray(),
  ]);

  // Low stock reuses the availabilityOf thresholds (≤ 5 low, ≤ 0 out) as a snapshot report.
  const lowStockRows = await db.collection("inventory").aggregate([
    { $lookup: { from: "variants", localField: "variantId", foreignField: "_id", as: "variant" } },
    { $unwind: "$variant" },
    { $match: { "variant.state": "active" } },
    { $lookup: { from: "products", localField: "variant.productId", foreignField: "_id", as: "product" } },
    { $addFields: { sellable: { $max: [0, { $subtract: ["$onHand", "$reserved"] }] } } },
    { $match: { sellable: { $lte: 5 } } },
    { $sort: { sellable: 1, _id: 1 } },
    { $limit: 25 },
  ]).toArray();

  const summarizeTop = (row: Record<string, unknown>) => ({ productId: String((row["_id"] as Record<string, unknown>)["productId"]), slug: String((row["_id"] as Record<string, unknown>)["slug"]), name: String((row["_id"] as Record<string, unknown>)["name"]), units: Number(row["units"]), amountMinor: Number(row["amountMinor"]) });
  const byRevenue = topRows.slice(0, 10).map(summarizeTop);
  const byUnits = [...topRows].sort((a, b) => Number(b["units"]) - Number(a["units"])).slice(0, 10).map(summarizeTop);

  res.json({ data: {
    range: { from: from.toISOString(), to: to.toISOString(), bucket: rawBucket },
    revenueDefinition: { statesExcluded: [...NON_REVENUE_STATES], note: "Captured-money states only; partially_refunded counts at full original total; refunded money reported separately; timestamps are order createdAt (UTC); money in minor units." },
    revenue: revenueRows.map((row) => ({ bucketStart: row["_id"], amountMinor: Number(row["amountMinor"]), orders: Number(row["orders"]) })),
    refunded: { amountMinor: Number(refundedRow?.["amountMinor"] ?? 0), orders: Number(refundedRow?.["orders"] ?? 0) },
    ordersByState: stateRows.map((row) => ({ state: row["_id"], orders: Number(row["orders"]), amountMinor: Number(row["amountMinor"]) })),
    topProducts: { byRevenue, byUnits },
    lowStock: lowStockRows.map((row) => {
      const variant = row["variant"] as Record<string, unknown>;
      const product = (row["product"] as Record<string, unknown>[] | undefined)?.[0];
      return { variantId: String(variant["_id"]), sku: String(variant["sku"]), productName: String(product?.["name"] ?? ""), productSlug: String(product?.["slug"] ?? ""), onHand: Number(row["onHand"]), reserved: Number(row["reserved"]), sellable: Number(row["sellable"]), availability: availabilityOf(Number(row["sellable"])) };
    }),
  } });
}));

adminRouter.get("/orders", requirePermission("orders:read"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const orders = await db.collection("orders").find().sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: orders.map((order) => ({ id: order._id.toString(), reference: order.reference, state: order.state, total: order.totals?.total, customer: order.shipping?.email, createdAt: order.createdAt })) });
}));

adminRouter.patch("/orders/:reference/state", requirePermission("orders:manage"), asyncHandler(async (req, res) => {
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

adminRouter.get("/returns", requirePermission("returns:manage"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const returns = await db.collection("returns").find().sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: returns.map((item) => ({ id: item._id.toString(), reference: item.reference, state: item.state, reason: item.reason, resolution: item.resolution, createdAt: item.createdAt })) });
}));

adminRouter.patch("/returns/:id/state", requirePermission("returns:manage"), asyncHandler(async (req, res) => {
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

adminRouter.get("/reviews", requirePermission("reviews:moderate"), asyncHandler(async (req, res) => {
  const state = typeof req.query["state"] === "string" ? req.query["state"] : "pending";
  const db = await getDb();
  const reviews = await db.collection("reviews").find({ state }).sort({ createdAt: 1 }).limit(100).toArray();
  res.json({ data: reviews.map((item) => ({ id: item._id.toString(), productId: item.productId.toString(), rating: item.rating, title: item.title, body: item.body, verified: item.verified, state: item.state, createdAt: item.createdAt })) });
}));

adminRouter.patch("/reviews/:id/state", requirePermission("reviews:moderate"), asyncHandler(async (req, res) => {
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

adminRouter.get("/customers", requirePermission("customers:read"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const customers = await db.collection("users").find({}, { projection: { email: 1, displayName: 1, roles: 1, createdAt: 1, updatedAt: 1 } }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: customers.map((item) => ({ id: item._id.toString(), email: item.email, displayName: item.displayName, roles: item.roles, createdAt: item.createdAt })) });
}));

adminRouter.get("/audits", requirePermission("users:manage"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const logs = await db.collection("auditLogs").find({ smokeId: { $exists: false } }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: logs.map((item) => ({ id: item._id.toString(), actorId: item.actorId, action: item.action, entityType: item.entityType, entityId: item.entityId, createdAt: item.createdAt })) });
}));

function validId(value: unknown) { const id = String(value ?? ""); if (!ObjectId.isValid(id)) throw new AppError(422, "VALIDATION_FAILED", "Invalid identifier."); return new ObjectId(id); }
function productInput(body: Record<string, unknown> | undefined) {
  const allowed = new Set(["slug", "name", "brand", "category", "categorySlug", "priceMinor", "imageUrl", "blurb", "state", "specs", "images", "options", "variants"]);
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
export function safeMediaUrl(value: string) { return value.length <= 500 && (/^\/catalog\/[a-zA-Z0-9._-]+(?:\/[a-zA-Z0-9._-]+)?$/.test(value) || /^\/api\/v1\/media\/[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(value)) && !value.split("/").some((segment) => segment === "." || segment === ".."); }
function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) { if (Object.keys(body ?? {}).some((key) => !allowed.includes(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown fields are not allowed."); }
async function audit(db: Awaited<ReturnType<typeof getDb>>, actorId: string, action: string, entityType: string, entityId: string, changes: unknown, session?: ClientSession) { await db.collection("auditLogs").insertOne({ actorId, action, entityType, entityId, changes, createdAt: new Date() }, session ? { session } : undefined); }

// ---------------------------------------------------------------- API-08/09/11 helpers

/** API-08: validates a promotion payload against the exact shape `activePromotion()` in
 *  routes/orders.ts consumes — { code, state, startsAt, endsAt, percentOff, maxDiscountMinor?
 *  } plus the optional display name. `current` supplies merge defaults when patching. */
function promotionInput(body: Record<string, unknown> | undefined, current: Record<string, unknown> | null) {
  const rawCode = typeof body?.["code"] === "string" ? body["code"].trim().toUpperCase() : "";
  const code = rawCode || (current ? String(current["code"]) : "");
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new AppError(422, "VALIDATION_FAILED", "Promotion code must be 2-40 characters of letters, digits, dashes or underscores.");
  const name = typeof body?.["name"] === "string" ? body["name"].trim().slice(0, 80) : current ? String(current["name"] ?? "") : "";
  const percentOff = body?.["percentOff"] === undefined && current ? Number(current["percentOff"]) : Number(body?.["percentOff"]);
  if (!Number.isInteger(percentOff) || percentOff < 1 || percentOff > 100) throw new AppError(422, "VALIDATION_FAILED", "percentOff must be an integer between 1 and 100.");
  let maxDiscountMinor: number | undefined;
  if (body?.["maxDiscountMinor"] === null) maxDiscountMinor = undefined;
  else if (body?.["maxDiscountMinor"] !== undefined) {
    maxDiscountMinor = Number(body["maxDiscountMinor"]);
    if (!Number.isInteger(maxDiscountMinor) || maxDiscountMinor < 1 || maxDiscountMinor > 100_000_000) throw new AppError(422, "VALIDATION_FAILED", "maxDiscountMinor must be a positive minor-unit integer.");
  } else if (current && current["maxDiscountMinor"] !== undefined && current["maxDiscountMinor"] !== null) maxDiscountMinor = Number(current["maxDiscountMinor"]);
  const toDate = (value: unknown, fallback: unknown): Date => {
    const source = value ?? fallback;
    const date = source instanceof Date ? source : new Date(String(source ?? ""));
    if (Number.isNaN(date.getTime())) throw new AppError(422, "VALIDATION_FAILED", "startsAt and endsAt must be valid dates.");
    return date;
  };
  const startsAt = toDate(body?.["startsAt"], current?.["startsAt"]);
  const endsAt = toDate(body?.["endsAt"], current?.["endsAt"]);
  if (!(startsAt.getTime() < endsAt.getTime())) throw new AppError(422, "VALIDATION_FAILED", "startsAt must come before endsAt.");
  const state = body?.["state"] === undefined ? (current ? String(current["state"]) : "active") : String(body["state"]);
  if (!["active", "archived"].includes(state)) throw new AppError(422, "VALIDATION_FAILED", "Promotion state must be active or archived.");
  return { code, name, kind: "percentage" as const, percentOff, ...(maxDiscountMinor !== undefined ? { maxDiscountMinor } : {}), state, startsAt, endsAt };
}

function serializePromotion(promotion: Record<string, unknown>) {
  return { id: String(promotion["_id"]), code: promotion["code"], name: promotion["name"] ?? "", kind: promotion["kind"] ?? "percentage", percentOff: Number(promotion["percentOff"]), maxDiscountMinor: promotion["maxDiscountMinor"] === undefined || promotion["maxDiscountMinor"] === null ? null : Number(promotion["maxDiscountMinor"]), state: promotion["state"], startsAt: promotion["startsAt"], endsAt: promotion["endsAt"], createdAt: promotion["createdAt"], updatedAt: promotion["updatedAt"] };
}

function iconOfImageUrl(value: unknown) { const url = typeof value === "string" ? value : ""; return url.startsWith("/catalog/") ? url.slice("/catalog/".length) : ""; }

/** API-09: categories carry { slug, name, blurb, imageUrl ("/catalog/<c-*.svg>"), state } —
 *  the same shape the seeder writes, so the storefront grid keeps rendering unchanged. */
function categoryInput(body: Record<string, unknown> | undefined, current: Record<string, unknown> | null) {
  const slugSource = typeof body?.["slug"] === "string" ? body["slug"].trim().toLowerCase() : current ? String(current["slug"]) : "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugSource)) throw new AppError(422, "VALIDATION_FAILED", "Category slug must be kebab-case.");
  const name = typeof body?.["name"] === "string" ? body["name"].trim() : current ? String(current["name"]) : "";
  if (name.length < 2 || name.length > 80) throw new AppError(422, "VALIDATION_FAILED", "Category name must be 2-80 characters.");
  const blurb = typeof body?.["blurb"] === "string" ? body["blurb"].trim() : current ? String(current["blurb"] ?? "") : "";
  if (blurb.length < 4 || blurb.length > 280) throw new AppError(422, "VALIDATION_FAILED", "Category blurb must be 4-280 characters.");
  const icon = typeof body?.["icon"] === "string" ? body["icon"].trim() : current ? iconOfImageUrl(current["imageUrl"]) : "";
  if (!/^c-[a-z0-9._-]+\.svg$/i.test(icon) || icon.includes("..")) throw new AppError(422, "VALIDATION_FAILED", "Category art must be a c-*.svg asset from frontend/public/catalog.");
  const state = body?.["state"] === undefined ? (current ? String(current["state"] ?? "published") : "published") : String(body["state"]);
  if (!["published", "archived"].includes(state)) throw new AppError(422, "VALIDATION_FAILED", "Category state must be published or archived.");
  return { slug: slugSource, name, blurb, imageUrl: `/catalog/${icon}`, state };
}

function serializeCategory(category: Record<string, unknown> | null) {
  if (!category) throw new AppError(500, "CATEGORY_UPDATE_FAILED", "The category could not be updated.");
  const imageUrl = typeof category["imageUrl"] === "string" ? category["imageUrl"] : "";
  return { id: String(category["_id"]), slug: category["slug"], name: category["name"], blurb: category["blurb"], icon: iconOfImageUrl(imageUrl), imageUrl, state: category["state"], createdAt: category["createdAt"], updatedAt: category["updatedAt"] };
}

function parseDateQuery(value: unknown): Date {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new AppError(422, "VALIDATION_FAILED", "from and to must be valid ISO dates.");
  return date;
}

// ---------------------------------------------------------------- API-07 editor helpers

type SpecInput = { label: string; value: string };
type VariantSeed = { sku: string; name: string; options: Record<string, string>; priceMinor: number; compareAtPriceMinor?: number; imageIndex: number; onHand: number };

/** API-07: parses the optional editor arrays off a create payload. `variants === null` keeps
 *  the legacy single "Standard" variant behaviour for old-form payloads. */
function productExtras(body: Record<string, unknown> | undefined, slug: string, basePriceMinor: number) {
  const specs = body?.["specs"] === undefined ? [] : parseSpecs(body["specs"]);
  const images = body?.["images"] === undefined ? [] : parseImages(body["images"]);
  const options = body?.["options"] === undefined ? [] : parseOptions(body["options"]);
  const variants = body?.["variants"] === undefined ? null : parseVariantList(body["variants"], options, images.length, basePriceMinor, slug);
  return { specs, images, options, variants };
}

function parseSpecs(value: unknown): SpecInput[] {
  if (!Array.isArray(value) || value.length > 50) throw new AppError(422, "VALIDATION_FAILED", "Specs must be an array of at most 50 label/value pairs.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new AppError(422, "VALIDATION_FAILED", "Each spec must be an object.");
    const spec = entry as Record<string, unknown>;
    rejectUnknown(spec, ["label", "value"]);
    const label = typeof spec["label"] === "string" ? spec["label"].trim() : "";
    const specValue = typeof spec["value"] === "string" ? spec["value"].trim() : "";
    if (label.length < 1 || label.length > 80 || specValue.length < 1 || specValue.length > 200) throw new AppError(422, "VALIDATION_FAILED", "Spec labels must be 1-80 characters and values 1-200 characters.");
    return { label, value: specValue };
  });
}

function parseImages(value: unknown): ProductImage[] {
  if (!Array.isArray(value) || value.length > 12) throw new AppError(422, "VALIDATION_FAILED", "Images must be an array of at most 12 entries.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new AppError(422, "VALIDATION_FAILED", "Each image must be an object.");
    const image = entry as Record<string, unknown>;
    rejectUnknown(image, ["url", "alt", "width", "height", "sources"]);
    const url = typeof image["url"] === "string" ? image["url"].trim() : "";
    // CAT-02-widened validator applied to EVERY gallery entry, not just the scalar hero URL.
    if (!safeMediaUrl(url)) throw new AppError(422, "MEDIA_URL_INVALID", "Every gallery image must use repository catalog media or Bazaar-managed media.");
    const alt = typeof image["alt"] === "string" ? image["alt"].trim().slice(0, 200) : "";
    const width = image["width"] === undefined ? 800 : Number(image["width"]);
    const height = image["height"] === undefined ? 1000 : Number(image["height"]);
    if (!Number.isInteger(width) || width < 0 || width > 10_000 || !Number.isInteger(height) || height < 0 || height > 10_000) throw new AppError(422, "VALIDATION_FAILED", "Image dimensions must be non-negative integers.");
    const rawSources = image["sources"] === undefined ? [] : image["sources"];
    if (!Array.isArray(rawSources) || rawSources.length > 6) throw new AppError(422, "VALIDATION_FAILED", "Image sources must be an array of at most 6 entries.");
    const sources = rawSources.map((source) => {
      if (!source || typeof source !== "object" || Array.isArray(source)) throw new AppError(422, "VALIDATION_FAILED", "Each image source must be an object.");
      const sourceRecord = source as Record<string, unknown>;
      rejectUnknown(sourceRecord, ["width", "url"]);
      const sourceWidth = Number(sourceRecord["width"]);
      const sourceUrl = typeof sourceRecord["url"] === "string" ? sourceRecord["url"].trim() : "";
      if (!Number.isInteger(sourceWidth) || sourceWidth <= 0 || !safeMediaUrl(sourceUrl)) throw new AppError(422, "MEDIA_URL_INVALID", "Image sources need a positive integer width and a valid media URL.");
      return { width: sourceWidth, url: sourceUrl };
    });
    return { url, sources, alt, width, height };
  });
}

function parseOptions(value: unknown): ProductOption[] {
  if (!Array.isArray(value) || value.length > 3) throw new AppError(422, "VALIDATION_FAILED", "Options must be an array of at most 3 axes.");
  const seenNames = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new AppError(422, "VALIDATION_FAILED", "Each option must be an object.");
    const option = entry as Record<string, unknown>;
    rejectUnknown(option, ["name", "values"]);
    const name = typeof option["name"] === "string" ? option["name"].trim() : "";
    const values = Array.isArray(option["values"]) ? option["values"].map((item) => (typeof item === "string" ? item.trim() : "")) : [];
    if (name.length < 1 || name.length > 40 || !values.length || values.length > 24 || values.some((item) => item.length < 1 || item.length > 60)) throw new AppError(422, "VALIDATION_FAILED", "Option names must be 1-40 characters with 1-24 values of 1-60 characters each.");
    if (seenNames.has(name.toLowerCase())) throw new AppError(422, "VALIDATION_FAILED", "Option names must be unique.");
    seenNames.add(name.toLowerCase());
    if (new Set(values.map((item) => item.toLowerCase())).size !== values.length) throw new AppError(422, "VALIDATION_FAILED", `Option "${name}" values must be unique.`);
    return { name, values };
  });
}

/** Aligns a variant's optionValues (array in options[] order, or record keyed by option name)
 *  against the product's declared axes — length AND order AND membership are enforced. */
function normalizeOptionValues(raw: unknown, options: ProductOption[]): string[] {
  let values: string[];
  if (Array.isArray(raw)) values = raw.map((item) => (typeof item === "string" ? item.trim() : ""));
  else if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Object.keys(record).some((key) => !options.some((option) => option.name === key))) throw new AppError(422, "VALIDATION_FAILED", "Variant option keys must match the product's options.");
    values = options.map((option) => {
      const item = record[option.name];
      return typeof item === "string" ? item.trim() : "";
    });
  } else values = [];
  if (values.length !== options.length) throw new AppError(422, "VALIDATION_FAILED", "Every variant needs exactly one value per product option, in order.");
  values.forEach((value, index) => {
    const option = options[index];
    if (!option || !option.values.some((candidate) => candidate.toLowerCase() === value.toLowerCase())) throw new AppError(422, "VALIDATION_FAILED", "Variant option values must match the product's declared option values.");
  });
  return values;
}

function parseVariantList(value: unknown, options: ProductOption[], imageCount: number, basePriceMinor: number, slug: string): VariantSeed[] {
  if (!Array.isArray(value) || value.length > 100) throw new AppError(422, "VALIDATION_FAILED", "Variants must be an array of at most 100 entries.");
  const skus = new Set<string>();
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new AppError(422, "VALIDATION_FAILED", "Each variant must be an object.");
    const variant = entry as Record<string, unknown>;
    rejectUnknown(variant, ["optionValues", "sku", "name", "priceMinor", "compareAtPriceMinor", "imageIndex", "onHand"]);
    const values = normalizeOptionValues(variant["optionValues"], options);
    const priceMinor = variant["priceMinor"] === undefined ? basePriceMinor : Number(variant["priceMinor"]);
    if (!Number.isInteger(priceMinor) || priceMinor < 0 || priceMinor > 100_000_000) throw new AppError(422, "VALIDATION_FAILED", "Variant priceMinor must be a valid minor-unit price.");
    let compareAtPriceMinor: number | undefined;
    if (variant["compareAtPriceMinor"] !== undefined && variant["compareAtPriceMinor"] !== null) {
      compareAtPriceMinor = Number(variant["compareAtPriceMinor"]);
      if (!Number.isInteger(compareAtPriceMinor) || compareAtPriceMinor < priceMinor || compareAtPriceMinor > 100_000_000) throw new AppError(422, "VALIDATION_FAILED", "Variant compare-at price cannot be below the sale price.");
    }
    const imageIndex = variant["imageIndex"] === undefined ? 0 : Number(variant["imageIndex"]);
    if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= Math.max(imageCount, 1)) throw new AppError(422, "VALIDATION_FAILED", "Variant imageIndex must point at a gallery image.");
    const onHand = variant["onHand"] === undefined ? 0 : Number(variant["onHand"]);
    if (!Number.isInteger(onHand) || onHand < 0 || onHand > 1_000_000) throw new AppError(422, "VALIDATION_FAILED", "Variant onHand must be a non-negative integer.");
    const suppliedSku = typeof variant["sku"] === "string" ? variant["sku"].trim().toUpperCase() : "";
    if (suppliedSku && !/^[A-Z0-9_-]{2,64}$/.test(suppliedSku)) throw new AppError(422, "VALIDATION_FAILED", "Variant SKU must be 2-64 characters of letters, digits, dashes or underscores.");
    const sku = suppliedSku || generatedSku(slug, values);
    if (skus.has(sku)) throw new AppError(422, "VALIDATION_FAILED", "Variant SKUs must be unique within the product.");
    skus.add(sku);
    const name = typeof variant["name"] === "string" && variant["name"].trim() ? variant["name"].trim().slice(0, 120) : values.join(" / ") || "Standard";
    return { sku, name, options: Object.fromEntries(options.map((option, index) => [option.name, values[index] ?? ""])), priceMinor, ...(compareAtPriceMinor !== undefined ? { compareAtPriceMinor } : {}), imageIndex, onHand };
  });
}

function generatedSku(slug: string, values: string[]): string {
  const suffix = values.map((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "")).join("-").slice(0, 40);
  const base = productSku(slug);
  return suffix ? `${base}-${suffix}`.slice(0, 64) : base;
}

/** Shape-checks the patch-time variant operation envelope; contents are parsed inside the
 *  transaction once the product's effective options/images are known. */
function parseVariantOps(value: unknown): Record<string, unknown> | null {
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError(422, "VALIDATION_FAILED", "Variant operations must be an object with optional add/update/archive lists.");
  const ops = value as Record<string, unknown>;
  rejectUnknown(ops, ["add", "update", "archive"]);
  for (const key of ["add", "update", "archive"]) if (ops[key] !== undefined && !Array.isArray(ops[key])) throw new AppError(422, "VALIDATION_FAILED", `Variant ${key} must be an array.`);
  return ops;
}

function parseVariantUpdates(value: unknown, options: ProductOption[], imageCount: number) {
  if (!Array.isArray(value) || value.length > 100) throw new AppError(422, "VALIDATION_FAILED", "Variant updates must be an array of at most 100 entries.");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new AppError(422, "VALIDATION_FAILED", "Each variant update must be an object.");
    const update = entry as Record<string, unknown>;
    rejectUnknown(update, ["id", "name", "priceMinor", "compareAtPriceMinor", "imageIndex", "optionValues"]);
    const id = validId(update["id"]);
    const set: Record<string, unknown> = {};
    if (update["name"] !== undefined) {
      const name = typeof update["name"] === "string" ? update["name"].trim() : "";
      if (name.length < 1 || name.length > 120) throw new AppError(422, "VALIDATION_FAILED", "Variant name must be 1-120 characters.");
      set["name"] = name;
    }
    if (update["priceMinor"] !== undefined) {
      const priceMinor = Number(update["priceMinor"]);
      if (!Number.isInteger(priceMinor) || priceMinor < 0 || priceMinor > 100_000_000) throw new AppError(422, "VALIDATION_FAILED", "Variant priceMinor must be a valid minor-unit price.");
      set["priceMinor"] = priceMinor;
    }
    if (update["compareAtPriceMinor"] !== undefined && update["compareAtPriceMinor"] !== null) {
      const compareAt = Number(update["compareAtPriceMinor"]);
      const price = typeof set["priceMinor"] === "number" ? set["priceMinor"] : undefined;
      if (!Number.isInteger(compareAt) || compareAt < 0 || compareAt > 100_000_000 || (price !== undefined && compareAt < price)) throw new AppError(422, "VALIDATION_FAILED", "Variant compare-at price cannot be below the sale price.");
      set["compareAtPriceMinor"] = compareAt;
    }
    if (update["imageIndex"] !== undefined) {
      const imageIndex = Number(update["imageIndex"]);
      if (!Number.isInteger(imageIndex) || imageIndex < 0 || imageIndex >= Math.max(imageCount, 1)) throw new AppError(422, "VALIDATION_FAILED", "Variant imageIndex must point at a gallery image.");
      set["imageIndex"] = imageIndex;
    }
    if (update["optionValues"] !== undefined) {
      const values = normalizeOptionValues(update["optionValues"], options);
      set["options"] = Object.fromEntries(options.map((option, index) => [option.name, values[index] ?? ""]));
    }
    if (!Object.keys(set).length && update["compareAtPriceMinor"] !== null) throw new AppError(422, "VALIDATION_FAILED", "Each variant update needs at least one field.");
    return { id, set, ...(update["compareAtPriceMinor"] === null ? { unset: { compareAtPriceMinor: "" } } : {}) };
  });
}

/** True when a stored variant `options` record maps exactly onto the declared axes. */
function optionValuesMatch(options: ProductOption[], record: Record<string, unknown>): boolean {
  if (Object.keys(record).length !== options.length) return false;
  return options.every((option) => {
    const value = record[option.name];
    return typeof value === "string" && option.values.some((candidate) => candidate.toLowerCase() === value.toLowerCase());
  });
}

/** API-07: applies add/update/archive variant operations inside the caller's transaction.
 *  Adds create their inventory document in the same transaction; archives never delete —
 *  order lines reference variant ids forever, and reserved stock is left untouched. */
async function applyVariantOps(db: Awaited<ReturnType<typeof getDb>>, productId: ObjectId, raw: Record<string, unknown> | null, options: ProductOption[], imageCount: number, basePriceMinor: number, slug: string, session: ClientSession): Promise<{ added: number; updated: number; archived: number }> {
  if (!raw) return { added: 0, updated: 0, archived: 0 };
  const now = new Date();
  const report = { added: 0, updated: 0, archived: 0 };
  const addList = raw["add"] === undefined ? [] : parseVariantList(raw["add"], options, imageCount, basePriceMinor, slug);
  for (const seed of addList) {
    const variantId = new ObjectId();
    await db.collection("variants").insertOne({ _id: variantId, productId, sku: seed.sku, name: seed.name, options: seed.options, priceMinor: seed.priceMinor, ...(seed.compareAtPriceMinor !== undefined ? { compareAtPriceMinor: seed.compareAtPriceMinor } : {}), imageIndex: seed.imageIndex, state: "active", createdAt: now, updatedAt: now }, { session });
    await db.collection("inventory").insertOne({ variantId, onHand: seed.onHand, reserved: 0, version: 1, updatedAt: now }, { session });
    report.added += 1;
  }
  const updateList = raw["update"] === undefined ? [] : parseVariantUpdates(raw["update"], options, imageCount);
  for (const op of updateList) {
    const changed = await db.collection("variants").findOneAndUpdate({ _id: op.id, productId, state: "active" }, { $set: { ...op.set, updatedAt: now }, ...(op.unset ? { $unset: op.unset } : {}) }, { session });
    if (!changed) throw new AppError(404, "VARIANT_NOT_FOUND", "A variant to update was not found or is archived.");
    report.updated += 1;
  }
  const archiveList = raw["archive"] === undefined ? [] : (raw["archive"] as unknown[]).map((entry) => validId(entry));
  if (archiveList.length) {
    const result = await db.collection("variants").updateMany({ _id: { $in: archiveList }, productId, state: "active" }, { $set: { state: "archived", updatedAt: now } }, { session });
    if (result.modifiedCount !== archiveList.length) throw new AppError(404, "VARIANT_NOT_FOUND", "A variant to archive was not found or is already archived.");
    report.archived = result.modifiedCount;
  }
  return report;
}

/** API-07: the SAME aggregation the moderation endpoint uses (reviews published for the
 *  product) — every editor mutation refreshes rating/reviewCount through this pipeline,
 *  never through hardcoded numbers. */
async function recomputeProductRating(db: Awaited<ReturnType<typeof getDb>>, productId: ObjectId) {
  const summary = await db.collection("reviews").aggregate([{ $match: { productId, state: "published" } }, { $group: { _id: "$productId", rating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } }]).next();
  await db.collection("products").updateOne({ _id: productId }, { $set: { rating: Number(summary?.["rating"] ?? 0), reviewCount: Number(summary?.["reviewCount"] ?? 0), updatedAt: new Date() } });
}
