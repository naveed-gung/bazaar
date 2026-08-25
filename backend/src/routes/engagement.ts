import { MongoServerError, ObjectId, type Document, type ObjectId as ObjectIdType } from "mongodb";
import { Router } from "express";
import { getDb } from "../database/client.js";
import { inventoryByProduct, serializeProduct, type ProductDocument } from "../domain/catalog.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { requireUser } from "../middleware/auth.js";
import { requireActiveGuest } from "../middleware/guest.js";
import { rateLimit } from "../middleware/rate-limit.js";

type ComparisonDocument = { _id?: ObjectId; ownerKey: string; productIds: ObjectId[]; createdAt: Date; updatedAt: Date };
type RecentlyViewedDocument = Document & { _id: ObjectId; ownerKey: string; productId: ObjectId; viewedAt: Date; createdAt: Date };

export const engagementRouter = Router();

/** Hard cap per owner so recentlyViewed cannot grow without bound (TTL in the manifest handles staleness). */
const RECENTLY_VIEWED_CAP = 20;
const RECENTLY_VIEWED_RAIL = 10;

engagementRouter.get("/favorites", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb();
  const favorites = await db.collection("favorites").aggregate([
    { $match: { ownerKey: ownerKey(req) } },
    { $lookup: { from: "products", localField: "productId", foreignField: "_id", as: "product" } },
    { $unwind: "$product" },
    { $replaceRoot: { newRoot: "$product" } },
    { $sort: { createdAt: -1 } },
  ]).toArray();
  res.json({ data: favorites.map((item) => ({ slug: item.slug })) });
}));

engagementRouter.put("/favorites/:slug", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb();
  const product = await db.collection("products").findOne({ slug: req.params["slug"], state: "published" });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const existing = await db.collection("favorites").findOne({ ownerKey: ownerKey(req), productId: product._id });
  if (!existing && await db.collection("favorites").countDocuments({ ownerKey: ownerKey(req) }) >= 200) throw new AppError(409, "FAVORITES_LIMIT", "Favorites can contain up to 200 products.");
  await db.collection("favorites").updateOne({ ownerKey: ownerKey(req), productId: product._id }, { $setOnInsert: { ownerKey: ownerKey(req), productId: product._id, createdAt: new Date() } }, { upsert: true });
  res.status(201).json({ data: { slug: product.slug, favorite: true } });
}));

engagementRouter.delete("/favorites/:slug", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb();
  const product = await db.collection("products").findOne({ slug: req.params["slug"] });
  if (product) await db.collection("favorites").deleteOne({ ownerKey: ownerKey(req), productId: product._id });
  res.status(204).end();
}));

engagementRouter.get("/comparison", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb(); const comparison = await db.collection<ComparisonDocument>("comparisons").findOne({ ownerKey: ownerKey(req) });
  const products = await db.collection<ProductDocument>("products").find({ _id: { $in: comparison?.["productIds"] ?? [] }, state: "published" }).toArray();
  const inventories = await inventoryByProduct(db, products.map((item) => item._id));
  res.json({ data: products.map((item) => serializeProduct(item, inventories.get(item._id.toHexString()) ?? 0)) });
}));

engagementRouter.put("/comparison/:slug", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb(); const product = await db.collection("products").findOne({ slug: req.params["slug"], state: "published" }); if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const existing = await db.collection<ComparisonDocument>("comparisons").findOne({ ownerKey: ownerKey(req) }); const ids = existing?.productIds ?? [];
  if (ids.some((id) => id.equals(product._id))) { res.json({ data: { count: ids.length } }); return; }
  if (ids.length >= 4) throw new AppError(409, "COMPARISON_LIMIT", "Compare up to four products at a time.");
  await db.collection<ComparisonDocument>("comparisons").updateOne({ ownerKey: ownerKey(req) }, { $setOnInsert: { ownerKey: ownerKey(req), createdAt: new Date() }, $push: { productIds: product._id }, $set: { updatedAt: new Date() } }, { upsert: true });
  res.status(201).json({ data: { count: ids.length + 1 } });
}));

engagementRouter.delete("/comparison/:slug", requireActiveGuest, asyncHandler(async (req, res) => {
  const db = await getDb(); const product = await db.collection("products").findOne({ slug: req.params["slug"] }); if (product) await db.collection<ComparisonDocument>("comparisons").updateOne({ ownerKey: ownerKey(req) }, { $pull: { productIds: product._id }, $set: { updatedAt: new Date() } }); res.status(204).end();
}));

// ------------------------------------------------------------------ API-04 recently viewed

async function recordViewed(req: Parameters<typeof ownerKey>[0], res: import("express").Response): Promise<void> {
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
  if (!slug || slug.length > 200) throw new AppError(422, "VALIDATION_FAILED", "A product slug is required.");
  const db = await getDb();
  const product = await db.collection("products").findOne({ slug, state: "published" }, { projection: { _id: 1 } });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const now = new Date();
  // Upsert on (ownerKey, productId): a re-view moves the item to the front instead of duplicating.
  await db.collection<RecentlyViewedDocument>("recentlyViewed").updateOne(
    { ownerKey: ownerKey(req), productId: product._id },
    { $set: { viewedAt: now }, $setOnInsert: { ownerKey: ownerKey(req), productId: product._id, createdAt: now } },
    { upsert: true },
  );
  const stale = await db.collection<RecentlyViewedDocument>("recentlyViewed")
    .find({ ownerKey: ownerKey(req) }).sort({ viewedAt: -1 }).skip(RECENTLY_VIEWED_CAP)
    .project<{ _id: ObjectIdType }>({ _id: 1 }).toArray();
  if (stale.length) await db.collection<RecentlyViewedDocument>("recentlyViewed").deleteMany({ _id: { $in: stale.map((item) => item._id) } });
  res.status(204).end();
}

async function listViewed(req: Parameters<typeof ownerKey>[0], res: import("express").Response): Promise<void> {
  const excludeSlug = typeof req.query["exclude"] === "string" ? req.query["exclude"].trim().slice(0, 200) : "";
  const db = await getDb();
  let excludedId: ObjectId | null = null;
  if (excludeSlug) {
    const excluded = await db.collection("products").findOne({ slug: excludeSlug }, { projection: { _id: 1 } });
    excludedId = excluded?._id ?? null;
  }
  const views = await db.collection<RecentlyViewedDocument>("recentlyViewed").find({ ownerKey: ownerKey(req) }).sort({ viewedAt: -1 }).limit(RECENTLY_VIEWED_RAIL + 1).toArray();
  const ids = views
    .filter((view) => !excludedId || !view.productId.equals(excludedId))
    .slice(0, RECENTLY_VIEWED_RAIL)
    .map((view) => view.productId);
  if (!ids.length) { res.json({ data: [] }); return; }
  const products = await db.collection<ProductDocument>("products").find({ _id: { $in: ids }, state: "published" }).toArray();
  const byId = new Map(products.map((item) => [item._id.toString(), item]));
  const inventories = await inventoryByProduct(db, ids);
  const ordered: ReturnType<typeof serializeProduct>[] = [];
  for (const id of ids) {
    const product = byId.get(id.toString());
    if (product) ordered.push(serializeProduct(product, inventories.get(id.toString()) ?? 0));
  }
  res.json({ data: ordered });
}

// Registered at the repo's flat engagement convention (/viewed, sibling of /favorites) and at
// the documented /engagement/viewed alias so both spellings work.
engagementRouter.post("/viewed", requireActiveGuest, asyncHandler(async (req, res) => recordViewed(req, res)));
engagementRouter.post("/engagement/viewed", requireActiveGuest, asyncHandler(async (req, res) => recordViewed(req, res)));
engagementRouter.get("/viewed", requireActiveGuest, asyncHandler(async (req, res) => listViewed(req, res)));
engagementRouter.get("/engagement/viewed", requireActiveGuest, asyncHandler(async (req, res) => listViewed(req, res)));

// ------------------------------------------------------------------ API-03 reviews

engagementRouter.get("/products/:slug/reviews", asyncHandler(async (req, res) => {
  const db = await getDb(); const product = await db.collection("products").findOne({ slug: req.params["slug"] }); if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const reviews = await db.collection("reviews").find({ productId: product._id, state: "published" }).sort({ createdAt: -1 }).limit(100).toArray();
  const reviewIds = reviews.map((item) => item._id);
  const votedIds = new Set<string>();
  if (reviewIds.length) {
    const votes = await db.collection("reviewVotes").find({ reviewId: { $in: reviewIds }, ownerKey: ownerKey(req) }).project<{ reviewId: ObjectId }>({ reviewId: 1 }).toArray();
    for (const vote of votes) votedIds.add(vote.reviewId.toString());
  }
  const distributionRows = await db.collection("reviews").aggregate<{ _id: number; count: number }>([
    { $match: { productId: product._id, state: "published" } },
    { $group: { _id: "$rating", count: { $sum: 1 } } },
  ]).toArray();
  const distribution: Record<"1" | "2" | "3" | "4" | "5", number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let ratingSum = 0;
  let ratingCount = 0;
  for (const row of distributionRows) {
    const star = String(row._id);
    if (star === "1" || star === "2" || star === "3" || star === "4" || star === "5") {
      distribution[star] = row.count;
      ratingSum += Number(row._id) * row.count;
      ratingCount += row.count;
    }
  }
  // authorName stays pseudonymous by design — seeded review identities are anonymous and the
  // platform never exposes reviewer names.
  res.json({
    data: reviews.map((item) => ({
      id: item._id.toString(),
      rating: item.rating,
      title: item.title,
      body: item.body,
      authorName: item.verified ? "Verified buyer" : "Bazaar customer",
      verifiedPurchase: Boolean(item.verified),
      helpfulCount: item.helpfulCount ?? 0,
      votedHelpful: votedIds.has(item._id.toString()),
      createdAt: item.createdAt,
    })),
    meta: {
      summary: {
        rating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
        reviewCount: ratingCount,
        distribution,
      },
    },
  });
}));

engagementRouter.post("/products/:slug/reviews", requireUser, asyncHandler(async (req, res) => {
  const rating = Number(req.body?.rating); const title = textField(req.body?.title, "title", 2, 120); const body = textField(req.body?.body, "review", 10, 2_000); const db = await getDb();
  const product = await db.collection("products").findOne({ slug: req.params["slug"] }); if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  // verifiedPurchase is computed server-side from a delivered order line referencing this
  // product (lines store productId as a hex string); no delivered order means no review.
  const order = await db.collection("orders").findOne({ ownerKey: ownerKey(req), state: "delivered", "lines.productId": product._id.toString() }); if (!order) throw new AppError(403, "VERIFIED_PURCHASE_REQUIRED", "Reviews require a delivered purchase.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(422, "VALIDATION_FAILED", "Rating must be from one to five.");
  const result = await db.collection("reviews").insertOne({ productId: product._id, userId: req.principal.id, orderId: order._id, rating, title, body, verified: true, helpfulCount: 0, state: "pending", createdAt: new Date(), updatedAt: new Date() });
  res.status(201).json({ data: { id: result.insertedId.toString(), state: "pending", verifiedPurchase: true } });
}));

engagementRouter.post("/reviews/:id/vote", requireUser, rateLimit({ name: "review-vote", limit: 30, windowMs: 60_000, principal: true }), asyncHandler(async (req, res) => {
  const reviewId = String(req.params["id"] ?? "");
  if (!ObjectId.isValid(reviewId)) throw new AppError(422, "VALIDATION_FAILED", "Invalid review id.");
  const helpful = req.body?.helpful === undefined ? true : req.body.helpful;
  if (typeof helpful !== "boolean") throw new AppError(422, "VALIDATION_FAILED", "The helpful flag must be a boolean.");
  const db = await getDb();
  const review = await db.collection("reviews").findOne({ _id: new ObjectId(reviewId), state: "published" });
  if (!review) throw new AppError(404, "REVIEW_NOT_FOUND", "Review not found.");
  const voterKey = ownerKey(req);
  if (helpful) {
    try {
      // The unique { reviewId, ownerKey } index is the double-vote guard: a concurrent second
      // insert loses with E11000 and never reaches the counter increment.
      await db.collection("reviewVotes").insertOne({ reviewId: review._id, ownerKey: voterKey, createdAt: new Date() });
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) throw error;
      res.json({ data: { helpfulCount: Number(review.helpfulCount ?? 0), votedHelpful: true, alreadyVoted: true } });
      return;
    }
    const updated = await db.collection("reviews").findOneAndUpdate({ _id: review._id }, { $inc: { helpfulCount: 1 } }, { returnDocument: "after" });
    res.status(201).json({ data: { helpfulCount: Number(updated?.helpfulCount ?? 0) || Number(review.helpfulCount ?? 0) + 1, votedHelpful: true } });
    return;
  }
  const removed = await db.collection("reviewVotes").deleteOne({ reviewId: review._id, ownerKey: voterKey });
  let helpfulCount = Number(review.helpfulCount ?? 0);
  if (removed.deletedCount) {
    const updated = await db.collection("reviews").findOneAndUpdate({ _id: review._id, helpfulCount: { $gt: 0 } }, { $inc: { helpfulCount: -1 } }, { returnDocument: "after" });
    helpfulCount = updated ? Number(updated.helpfulCount ?? 0) : Math.max(0, helpfulCount - 1);
  }
  res.json({ data: { helpfulCount, votedHelpful: false } });
}));

engagementRouter.get("/notifications", requireUser, asyncHandler(async (req, res) => { const db = await getDb(); const items = await db.collection("notifications").find({ userId: req.principal.id }).sort({ createdAt: -1 }).limit(100).toArray(); res.json({ data: items.map((item) => ({ id: item._id.toString(), type: item.type, title: item.title, body: item.body, readAt: item.readAt, createdAt: item.createdAt })) }); }));

engagementRouter.post("/newsletter", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const db = await getDb();
  await db.collection("newsletterSubscriptions").updateOne({ email }, { $set: { status: "subscribed", updatedAt: new Date() }, $setOnInsert: { createdAt: new Date(), source: "website" } }, { upsert: true });
  res.status(202).json({ data: { status: "subscribed" } });
}));

engagementRouter.post("/contact", asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = textField(req.body?.name, "name", 2, 100);
  const subject = textField(req.body?.subject, "subject", 3, 160);
  const message = textField(req.body?.message, "message", 10, 4_000);
  const db = await getDb();
  const result = await db.collection("contactMessages").insertOne({ email, name, subject, message, state: "new", requestId: req.id, createdAt: new Date() });
  res.status(202).json({ data: { reference: `MSG-${result.insertedId.toString().slice(-8).toUpperCase()}`, status: "received" } });
}));

engagementRouter.post("/assistant", requireActiveGuest, asyncHandler(async (req, res) => {
  const prompt = textField(req.body?.message, "message", 2, 500).toLowerCase();
  const db = await getDb();
  let answer = "I can help find products, explain shipping, show cart totals, or guide returns and order tracking.";
  let actions: unknown[] = [];
  if (/headphone|audio|speaker/.test(prompt)) {
    const products = await db.collection("products").find({ state: "published", categorySlug: "audio" }).limit(3).project({ slug: 1, name: 1, priceMinor: 1 }).toArray();
    answer = products.length ? "Here are the strongest audio matches in the current catalog." : "No audio products are published right now.";
    actions = products.map((item) => ({ type: "view_product", label: item.name, href: `/product/${item.slug}`, price: { amountMinor: item.priceMinor, currency: "USD" } }));
  } else if (/cart|total/.test(prompt)) {
    const cart = await db.collection("carts").findOne({ ownerKey: ownerKey(req) });
    answer = cart?.["lines"]?.length ? `Your cart has ${cart.lines.reduce((sum: number, line: { quantity: number }) => sum + line.quantity, 0)} item(s). Open the cart for server-calculated totals.` : "Your cart is empty.";
    actions = [{ type: "navigate", label: "Open cart", href: "/cart" }];
  } else if (/return|refund/.test(prompt)) {
    answer = "Open the order from your account, choose an eligible item, select a reason, and submit the return request. Refunds never exceed the captured amount.";
    actions = [{ type: "navigate", label: "View orders", href: "/account" }];
  } else if (/ship|delivery/.test(prompt)) {
    answer = "Standard shipping is free over $50; otherwise it is $7.99. Delivery estimates appear before order review.";
  }
  res.json({ data: { answer, actions, mode: "deterministic", generatedAt: new Date().toISOString() } });
}));

function normalizeEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError(422, "VALIDATION_FAILED", "Enter a valid email address.");
  return email;
}

function textField(value: unknown, label: string, min: number, max: number) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min || result.length > max) throw new AppError(422, "VALIDATION_FAILED", `The ${label} must be between ${min} and ${max} characters.`);
  return result;
}
