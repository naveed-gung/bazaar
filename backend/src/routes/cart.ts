import { ObjectId } from "mongodb";
import { Router } from "express";
import { getDb } from "../database/client.js";
import { serializeCart, type CartDocument } from "../domain/cart.js";
import { AppError } from "../errors.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { requireActiveGuest } from "../middleware/guest.js";

export const cartRouter = Router();
cartRouter.use(requireActiveGuest);

cartRouter.get("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  const now = new Date();
  const cart = await db.collection<CartDocument>("carts").findOneAndUpdate(
    { ownerKey: ownerKey(req) },
    { $setOnInsert: { _id: new ObjectId(), ownerKey: ownerKey(req), revision: 1, lines: [], createdAt: now }, $set: { updatedAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  if (!cart) throw new AppError(500, "CART_UNAVAILABLE", "Cart could not be loaded.");
  res.json({ data: await serializeCart(db, cart) });
}));

cartRouter.post("/lines", asyncHandler(async (req, res) => {
  const slug = typeof req.body?.slug === "string" ? req.body.slug : "";
  const quantity = quantityInput(req.body?.quantity, true);
  if (!slug) throw new AppError(422, "VALIDATION_FAILED", "A product slug is required.");
  const db = await getDb();
  const product = await db.collection("products").findOne({ slug, state: "published" });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const variant = await db.collection("variants").findOne({ productId: product._id, state: "active" });
  if (!variant) throw new AppError(409, "VARIANT_UNAVAILABLE", "This product is unavailable.");
  const stock = await db.collection("inventory").findOne({ variantId: variant._id });
  const available = Number(stock?.["onHand"] ?? 0) - Number(stock?.["reserved"] ?? 0);
  if (available < quantity) throw new AppError(409, "INSUFFICIENT_STOCK", "The requested quantity is not available.", undefined, { available });

  const key = ownerKey(req);
  const now = new Date();
  let cart = await db.collection<CartDocument>("carts").findOne({ ownerKey: key });
  if (!cart) {
    await db.collection<CartDocument>("carts").insertOne({ _id: new ObjectId(), ownerKey: key, revision: 1, lines: [{ variantId: variant._id, quantity }], createdAt: now, updatedAt: now });
  } else {
    const line = cart.lines.find((item) => item.variantId.equals(variant._id));
    const nextQuantity = (line?.quantity ?? 0) + quantity;
    if (nextQuantity > available || nextQuantity > 10) throw new AppError(409, "QUANTITY_LIMIT", "The cart quantity exceeds the available limit.", undefined, { available, limit: 10 });
    if (line) await db.collection<CartDocument>("carts").updateOne({ _id: cart._id }, { $set: { "lines.$[line].quantity": nextQuantity, updatedAt: now }, $inc: { revision: 1 } }, { arrayFilters: [{ "line.variantId": variant._id }] });
    else {
      if (cart.lines.length >= 50) throw new AppError(409, "CART_LINE_LIMIT", "A cart can contain up to 50 different items.");
      await db.collection<CartDocument>("carts").updateOne({ _id: cart._id }, { $push: { lines: { variantId: variant._id, quantity } }, $set: { updatedAt: now }, $inc: { revision: 1 } });
    }
  }
  cart = await db.collection<CartDocument>("carts").findOne({ ownerKey: key });
  if (!cart) throw new AppError(500, "CART_UNAVAILABLE", "Cart could not be updated.");
  res.status(201).json({ data: await serializeCart(db, cart) });
}));

cartRouter.patch("/lines/:lineId", asyncHandler(async (req, res) => {
  const lineId = String(req.params["lineId"] ?? "");
  if (!ObjectId.isValid(lineId)) throw new AppError(422, "VALIDATION_FAILED", "Invalid cart line.");
  const quantity = quantityInput(req.body?.quantity, false);
  const db = await getDb();
  const stock = await db.collection("inventory").findOne({ variantId: new ObjectId(lineId) });
  const available = Math.max(0, Number(stock?.["onHand"] ?? 0) - Number(stock?.["reserved"] ?? 0));
  if (quantity > available) throw new AppError(409, "INSUFFICIENT_STOCK", "The requested quantity is not available.", undefined, { available });
  const result = await db.collection<CartDocument>("carts").findOneAndUpdate(
    { ownerKey: ownerKey(req), "lines.variantId": new ObjectId(lineId) },
    { $set: { "lines.$.quantity": quantity, updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new AppError(404, "CART_LINE_NOT_FOUND", "Cart line not found.");
  res.json({ data: await serializeCart(db, result) });
}));

function quantityInput(value: unknown, allowMissing: boolean) {
  if (allowMissing && value === undefined) return 1;
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) throw new AppError(422, "VALIDATION_FAILED", "Quantity must be an integer from 1 to 10.");
  return quantity;
}

cartRouter.delete("/lines/:lineId", asyncHandler(async (req, res) => {
  const lineId = String(req.params["lineId"] ?? "");
  if (!ObjectId.isValid(lineId)) throw new AppError(422, "VALIDATION_FAILED", "Invalid cart line.");
  const db = await getDb();
  const result = await db.collection<CartDocument>("carts").findOneAndUpdate(
    { ownerKey: ownerKey(req) },
    { $pull: { lines: { variantId: new ObjectId(lineId) } }, $set: { updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) throw new AppError(404, "CART_NOT_FOUND", "Cart not found.");
  res.json({ data: await serializeCart(db, result) });
}));

cartRouter.delete("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  await db.collection("carts").updateOne({ ownerKey: ownerKey(req) }, { $set: { lines: [], updatedAt: new Date() }, $inc: { revision: 1 } });
  res.status(204).end();
}));
