import { Router } from "express";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { requireUser } from "../middleware/auth.js";
import { requireActiveGuest } from "../middleware/guest.js";
import type { ObjectId } from "mongodb";

type ComparisonDocument = { _id?: ObjectId; ownerKey: string; productIds: ObjectId[]; createdAt: Date; updatedAt: Date };

export const engagementRouter = Router();

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
  const products = await db.collection("products").find({ _id: { $in: comparison?.["productIds"] ?? [] }, state: "published" }).toArray();
  res.json({ data: products.map((item) => ({ id: item._id.toString(), slug: item.slug, name: item.name, category: item.category, imageUrl: item.imageUrl, price: { amountMinor: item.priceMinor, currency: "USD" }, specs: item.specs })) });
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

engagementRouter.get("/products/:slug/reviews", asyncHandler(async (req, res) => {
  const db = await getDb(); const product = await db.collection("products").findOne({ slug: req.params["slug"] }); if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const reviews = await db.collection("reviews").find({ productId: product._id, state: "published" }).sort({ createdAt: -1 }).limit(100).toArray();
  res.json({ data: reviews.map((item) => ({ id: item._id.toString(), rating: item.rating, title: item.title, body: item.body, verified: item.verified, helpfulCount: item.helpfulCount ?? 0, createdAt: item.createdAt })) });
}));

engagementRouter.post("/products/:slug/reviews", requireUser, asyncHandler(async (req, res) => {
  const rating = Number(req.body?.rating); const title = textField(req.body?.title, "title", 2, 120); const body = textField(req.body?.body, "review", 10, 2_000); const db = await getDb();
  const product = await db.collection("products").findOne({ slug: req.params["slug"] }); if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const order = await db.collection("orders").findOne({ ownerKey: ownerKey(req), state: "delivered", "lines.productId": product._id.toString() }); if (!order) throw new AppError(403, "VERIFIED_PURCHASE_REQUIRED", "Reviews require a delivered purchase.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(422, "VALIDATION_FAILED", "Rating must be from one to five.");
  const result = await db.collection("reviews").insertOne({ productId: product._id, userId: req.principal.id, orderId: order._id, rating, title, body, verified: true, helpfulCount: 0, state: "pending", createdAt: new Date(), updatedAt: new Date() });
  res.status(201).json({ data: { id: result.insertedId.toString(), state: "pending" } });
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
