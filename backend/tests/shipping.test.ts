import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";
import { calculateCheckoutTotals } from "../src/domain/checkout.js";

const app = createApp();

const suffix = randomBytes(4).toString("hex");
const cheapSlug = `wt-ship-cheap-${suffix}`;
const priceySlug = `wt-ship-pricey-${suffix}`;
let cheapVariantId = new ObjectId();
let priceyVariantId = new ObjectId();

/**
 * Mirrors the seeder's shippingMethods documents so the quote endpoint has real rows to
 * resolve; npm run db:seed later makes these authoritative (idempotent upserts).
 */
async function ensureShippingMethods(): Promise<void> {
  const db = await getDb();
  const methods = [
    { key: "standard", name: "Standard delivery", description: "Free over $50 · otherwise $7.99 flat rate", rateMinor: 799, freeOverMinor: 5_000, etaDays: [3, 7] },
    { key: "express", name: "Express delivery", description: "Fast courier at a flat rate", rateMinor: 1_999, etaDays: [1, 3] },
    { key: "pickup", name: "Depot pickup", description: "Collect your order from the Bazaar depot", rateMinor: 0, etaDays: [1, 2] },
  ];
  for (const method of methods) {
    await db.collection("shippingMethods").updateOne(
      { key: method.key },
      {
        $set: {
          name: method.name,
          description: method.description,
          rateMinor: method.rateMinor,
          ...(method.freeOverMinor !== undefined ? { freeOverMinor: method.freeOverMinor } : {}),
          etaDays: method.etaDays as [number, number],
          state: "active",
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
}

beforeAll(async () => {
  const db = await getDb();
  await ensureShippingMethods();
  const now = new Date();
  const cheap = await db.collection("products").insertOne({
    slug: cheapSlug, name: "WaveTest Cheap", brand: "WaveTest", category: "Wave Test", categorySlug: "wave-test-cat",
    priceMinor: 2_500, rating: 4, reviewCount: 1, imageUrl: "/catalog/x/01-800.webp", blurb: "test", specs: [],
    state: "published", publishedAt: now, revision: 1, createdAt: now, updatedAt: now,
  });
  const pricey = await db.collection("products").insertOne({
    slug: priceySlug, name: "WaveTest Pricey", brand: "WaveTest", category: "Wave Test", categorySlug: "wave-test-cat",
    priceMinor: 6_000, rating: 4, reviewCount: 1, imageUrl: "/catalog/x/01-800.webp", blurb: "test", specs: [],
    state: "published", publishedAt: now, revision: 1, createdAt: now, updatedAt: now,
  });
  cheapVariantId = new ObjectId();
  priceyVariantId = new ObjectId();
  await db.collection("variants").insertMany([
    { _id: cheapVariantId, productId: cheap.insertedId, sku: `WT-SHIP-C-${suffix}`, name: "Standard", options: {}, priceMinor: 2_500, state: "active", createdAt: now, updatedAt: now },
    { _id: priceyVariantId, productId: pricey.insertedId, sku: `WT-SHIP-P-${suffix}`, name: "Standard", options: {}, priceMinor: 6_000, state: "active", createdAt: now, updatedAt: now },
  ]);
  await db.collection("inventory").insertMany([
    { variantId: cheapVariantId, onHand: 10, reserved: 0, version: 1, updatedAt: now },
    { variantId: priceyVariantId, onHand: 5, reserved: 0, version: 1, updatedAt: now },
  ]);
}, 30_000);

afterAll(async () => {
  const db = await getDb();
  const carts = await db.collection("carts").find({ "lines.variantId": { $in: [cheapVariantId, priceyVariantId] } }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  await Promise.all([
    db.collection("checkoutQuotes").deleteMany({ cartId: { $in: carts.map((cart) => cart._id) } }),
    db.collection("reservations").deleteMany({ variantId: { $in: [cheapVariantId, priceyVariantId] } }),
    db.collection("carts").deleteMany({ "lines.variantId": { $in: [cheapVariantId, priceyVariantId] } }),
    db.collection("inventory").deleteMany({ variantId: { $in: [cheapVariantId, priceyVariantId] } }),
  ]);
  const products = await db.collection("products").find({ slug: { $in: [cheapSlug, priceySlug] } }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  await Promise.all([
    db.collection("variants").deleteMany({ productId: { $in: products.map((product) => product._id) } }),
    db.collection("products").deleteMany({ slug: { $in: [cheapSlug, priceySlug] } }),
  ]);
}, 30_000);

describe("checkout pricing with shipping methods", () => {
  it("keeps the pinned legacy economics when no method is supplied", () => {
    expect(calculateCheckoutTotals(4_000)).toEqual({
      subtotalMinor: 4_000,
      discountMinor: 0,
      shippingMinor: 799,
      taxMinor: 320,
      totalMinor: 5_119,
    });
  });

  it("charges an express flat rate with no free-over threshold", () => {
    expect(calculateCheckoutTotals(40_000, undefined, { key: "express", rateMinor: 1_999 })).toEqual({
      subtotalMinor: 40_000,
      discountMinor: 0,
      shippingMinor: 1_999,
      taxMinor: 3_200,
      totalMinor: 45_199,
    });
  });

  it("supports zero-rate pickup", () => {
    expect(calculateCheckoutTotals(1_000, undefined, { key: "pickup", rateMinor: 0 })).toMatchObject({ shippingMinor: 0, totalMinor: 1_080 });
  });

  it("lists active shipping methods as DTOs", async () => {
    const response = await request(app).get("/api/v1/orders/shipping-methods").expect(200);
    const codes = response.body.data.map((method: { code: string }) => method.code);
    expect(codes).toEqual(expect.arrayContaining(["standard", "express", "pickup"]));
    const standard = response.body.data.find((method: { code: string }) => method.code === "standard");
    expect(standard.price).toEqual({ amountMinor: 799, currency: "USD" });
    expect(standard.etaDays).toEqual({ min: 3, max: 7 });
  }, 15_000);

  it("quotes standard shipping by default at the pinned 799 minor units", async () => {
    const browser = request.agent(app);
    await browser.post("/api/v1/cart/lines").set("origin", config.webOrigin).send({ slug: cheapSlug, quantity: 1 }).expect(201);
    const response = await browser.post("/api/v1/orders/quote").set("origin", config.webOrigin).send({}).expect(201);
    expect(response.body.data.totals.shipping.amountMinor).toBe(799);
    expect(response.body.data.shippingMethod.code).toBe("standard");
  }, 30_000);

  it("quotes express server-side when the client selects it", async () => {
    const browser = request.agent(app);
    await browser.post("/api/v1/cart/lines").set("origin", config.webOrigin).send({ slug: cheapSlug, quantity: 1 }).expect(201);
    const response = await browser.post("/api/v1/orders/quote").set("origin", config.webOrigin).send({ shippingMethod: "express" }).expect(201);
    expect(response.body.data.totals.shipping.amountMinor).toBe(1_999);
    expect(response.body.data.shippingMethod.code).toBe("express");
    expect(response.body.data.shippingMethod.etaDays).toEqual({ min: 1, max: 3 });
  }, 30_000);

  it("rejects an unknown shipping method key with 422", async () => {
    const browser = request.agent(app);
    await browser.post("/api/v1/cart/lines").set("origin", config.webOrigin).send({ slug: cheapSlug, quantity: 1 }).expect(201);
    const response = await browser.post("/api/v1/orders/quote").set("origin", config.webOrigin).send({ shippingMethod: "teleport" }).expect(422);
    expect(response.body.code).toBe("SHIPPING_METHOD_INVALID");
  }, 30_000);

  it("keeps standard free over the 5000 minor discounted subtotal", async () => {
    const browser = request.agent(app);
    await browser.post("/api/v1/cart/lines").set("origin", config.webOrigin).send({ slug: priceySlug, quantity: 1 }).expect(201);
    const response = await browser.post("/api/v1/orders/quote").set("origin", config.webOrigin).send({}).expect(201);
    expect(response.body.data.totals.subtotal.amountMinor).toBeGreaterThanOrEqual(5_000);
    expect(response.body.data.totals.shipping.amountMinor).toBe(0);
  }, 30_000);
});
