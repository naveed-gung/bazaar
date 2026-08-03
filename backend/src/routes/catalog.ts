import { type Sort } from "mongodb";
import { Router } from "express";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { inventoryByProduct, serializeProduct, type ProductDocument } from "../domain/catalog.js";
import { asyncHandler, parsePositiveInteger } from "../lib/http.js";

export const catalogRouter = Router();

catalogRouter.get("/categories", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const categories = await db.collection("categories").find({ state: "published" }).sort({ name: 1 }).toArray();
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ data: categories.map((item) => ({ id: item._id.toString(), slug: item.slug, name: item.name, imageUrl: item.imageUrl })) });
}));

catalogRouter.get("/products", asyncHandler(async (req, res) => {
  const db = await getDb();
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  const category = typeof req.query["category"] === "string" ? req.query["category"] : "";
  const badge = typeof req.query["badge"] === "string" ? req.query["badge"] : "";
  const limit = parsePositiveInteger(req.query["limit"], 24, 100);
  const page = parsePositiveInteger(req.query["page"], 1, 100);
  if (q.length > 100) throw new AppError(422, "QUERY_TOO_LONG", "Search terms must be 100 characters or fewer.");
  if (category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) throw new AppError(422, "FILTER_INVALID", "The category filter is invalid.");
  const filter: Record<string, unknown> = { state: "published" };
  if (category) filter["categorySlug"] = category;
  if (badge === "New" || badge === "Deal") filter["badge"] = badge;
  if (q) filter["$text"] = { $search: q };
  const sortParam = req.query["sort"];
  const sort: Sort = sortParam === "price-asc" ? { priceMinor: 1 } : sortParam === "price-desc" ? { priceMinor: -1 } : sortParam === "rating" ? { rating: -1, reviewCount: -1 } : { publishedAt: -1 };
  const [items, total] = await Promise.all([
    db.collection<ProductDocument>("products").find(filter).sort(sort).skip((page - 1) * limit).limit(limit).toArray(),
    db.collection("products").countDocuments(filter),
  ]);
  const inventories = await inventoryByProduct(db, items.map((item) => item._id));
  res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=120");
  res.json({ data: { items: items.map((item) => serializeProduct(item, inventories.get(item._id.toHexString()) ?? 0)), page, limit, total, pages: Math.ceil(total / limit) } });
}));

catalogRouter.get("/products/:slug", asyncHandler(async (req, res) => {
  const db = await getDb();
  const product = await db.collection<ProductDocument>("products").findOne({ slug: String(req.params["slug"] ?? ""), state: "published" });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const variant = await db.collection("variants").findOne({ productId: product._id, state: "active" });
  const inventory = variant ? await db.collection("inventory").findOne({ variantId: variant._id }) : null;
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ data: { ...serializeProduct(product, Math.max(0, Number(inventory?.["onHand"] ?? 0) - Number(inventory?.["reserved"] ?? 0))), variants: variant ? [{ id: variant._id.toString(), sku: variant["sku"], name: variant["name"], options: variant["options"], availability: inventory ? Math.max(0, Number(inventory["onHand"]) - Number(inventory["reserved"])) : 0 }] : [] } });
}));
