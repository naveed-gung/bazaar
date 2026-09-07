import request from "supertest";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";

const app = createApp();
const TEST_TOKEN = config.bazaarBotToken || "test-bot-token-secret";
const suffix = Math.random().toString(36).slice(2, 10);

const TEST_CATEGORY = `bot-audio-${suffix}`;
const PROD_IN_STOCK_SLUG = `bot-prod-instock-${suffix}`;
const PROD_OUT_STOCK_SLUG = `bot-prod-outstock-${suffix}`;
let inStockProdId: ObjectId;
let outStockProdId: ObjectId;

beforeAll(async () => {
  const db = await getDb();
  const now = new Date();

  // 1. Insert In-stock product with 2 variants
  inStockProdId = new ObjectId();
  await db.collection("products").insertOne({
    _id: inStockProdId,
    slug: PROD_IN_STOCK_SLUG,
    name: "Loom Test ANC Headphones",
    brand: "LoomBrand",
    category: "Audio Equipment",
    categorySlug: TEST_CATEGORY,
    priceMinor: 12900,
    rating: 4.8,
    reviewCount: 12,
    imageUrl: "/catalog/headphones/01-800.webp",
    blurb: "Active noise cancelling test headphones",
    specs: [{ label: "Battery", value: "30h" }],
    state: "published",
    publishedAt: now,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });

  const var1 = new ObjectId();
  const var2 = new ObjectId();

  await db.collection("variants").insertMany([
    {
      _id: var1,
      productId: inStockProdId,
      sku: `LTM-BLK-${suffix}`.toUpperCase(),
      name: "Matte Black",
      options: { Colour: "Matte Black" },
      priceMinor: 12900,
      state: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: var2,
      productId: inStockProdId,
      sku: `LTM-SLV-${suffix}`.toUpperCase(),
      name: "Silver",
      options: { Colour: "Silver" },
      priceMinor: 13900,
      state: "active",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Inventory: var1 has 10 onHand, 2 reserved -> 8 available. var2 has 5 onHand, 0 reserved -> 5 available.
  await db.collection("inventory").insertMany([
    { variantId: var1, onHand: 10, reserved: 2, version: 1, updatedAt: now },
    { variantId: var2, onHand: 5, reserved: 0, version: 1, updatedAt: now },
  ]);

  // 2. Insert Out-of-stock product
  outStockProdId = new ObjectId();
  await db.collection("products").insertOne({
    _id: outStockProdId,
    slug: PROD_OUT_STOCK_SLUG,
    name: "Loom Test Soldout Earbuds",
    brand: "LoomBrand",
    category: "Audio Equipment",
    categorySlug: TEST_CATEGORY,
    priceMinor: 5900,
    rating: 4.0,
    reviewCount: 3,
    imageUrl: "/catalog/earbuds/01-800.webp",
    blurb: "Sold out earbuds fixture",
    specs: [],
    state: "published",
    publishedAt: now,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  });

  const varOut = new ObjectId();
  await db.collection("variants").insertOne({
    _id: varOut,
    productId: outStockProdId,
    sku: `LTM-OUT-${suffix}`.toUpperCase(),
    name: "Default",
    options: {},
    priceMinor: 5900,
    state: "active",
    createdAt: now,
    updatedAt: now,
  });

  // Out of stock: 3 onHand, 3 reserved -> 0 available
  await db.collection("inventory").insertOne({
    variantId: varOut,
    onHand: 3,
    reserved: 3,
    version: 1,
    updatedAt: now,
  });
});

afterAll(async () => {
  const db = await getDb();
  const prodIds = [inStockProdId, outStockProdId].filter(Boolean);
  const variants = await db
    .collection("variants")
    .find({ productId: { $in: prodIds } })
    .project<{ _id: ObjectId }>({ _id: 1 })
    .toArray();

  await Promise.all([
    db
      .collection("inventory")
      .deleteMany({ variantId: { $in: variants.map((v) => v._id) } }),
    db.collection("variants").deleteMany({ productId: { $in: prodIds } }),
    db.collection("products").deleteMany({ _id: { $in: prodIds } }),
  ]);
});

describe("Assistant Catalog API (/api/v1/assistant/catalog) — Loom by Auvia Tool Contract", () => {
  describe("Authentication", () => {
    it("rejects requests missing the Authorization header with 401", async () => {
      const res = await request(app).get("/api/v1/assistant/catalog/search");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: "unauthorized",
          message: expect.stringContaining(
            "Missing or malformed Authorization header",
          ),
        },
      });
    });

    it("rejects requests with an invalid Bearer token with 401", async () => {
      const res = await request(app)
        .get("/api/v1/assistant/catalog/search")
        .set("Authorization", "Bearer bad-token-12345");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({
        error: {
          code: "unauthorized",
          message: "Invalid assistant bot token.",
        },
      });
    });

    it("accepts requests with the valid Bearer token", async () => {
      const res = await request(app)
        .get("/api/v1/assistant/catalog/search")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("results");
      expect(res.body).toHaveProperty("asOf");
    });
  });

  describe("GET /api/v1/assistant/catalog/search", () => {
    it("returns matching products with live stock and accurate price in minor units", async () => {
      const res = await request(app)
        .get(`/api/v1/assistant/catalog/search?category=${TEST_CATEGORY}`)
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.results)).toBe(true);

      const inStockItem = res.body.results.find(
        (item: { slug: string }) => item.slug === PROD_IN_STOCK_SLUG,
      );
      expect(inStockItem).toBeDefined();
      expect(inStockItem).toMatchObject({
        id: inStockProdId.toHexString(),
        slug: PROD_IN_STOCK_SLUG,
        name: "Loom Test ANC Headphones",
        category: TEST_CATEGORY,
        priceMinor: 12900,
        currency: "USD",
        inStock: true,
        availableQty: 13, // 8 from var1 + 5 from var2
      });
      expect(inStockItem.url).toMatch(/^https:\/\/.+\/p\/bot-prod-instock-/);
    });

    it("respects inStockOnly=true by filtering out products with 0 available stock", async () => {
      const res = await request(app)
        .get(
          `/api/v1/assistant/catalog/search?category=${TEST_CATEGORY}&inStockOnly=true`,
        )
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      const slugs = res.body.results.map((r: { slug: string }) => r.slug);
      expect(slugs).toContain(PROD_IN_STOCK_SLUG);
      expect(slugs).not.toContain(PROD_OUT_STOCK_SLUG);
    });

    it("supports keyword search query q", async () => {
      const res = await request(app)
        .get(`/api/v1/assistant/catalog/search?q=ANC+Headphones`)
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      const item = res.body.results.find(
        (r: { slug: string }) => r.slug === PROD_IN_STOCK_SLUG,
      );
      expect(item).toBeDefined();
    });

    it("enforces limit caps between 1 and 10", async () => {
      const res = await request(app)
        .get(`/api/v1/assistant/catalog/search?limit=1`)
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.results.length).toBeLessThanOrEqual(1);
    });
  });

  describe("GET /api/v1/assistant/catalog/product", () => {
    it("returns 422 when the id parameter is omitted", async () => {
      const res = await request(app)
        .get("/api/v1/assistant/catalog/product")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(422);
      expect(res.body).toEqual({
        error: {
          code: "validation_failed",
          message: "The 'id' query parameter is required.",
        },
      });
    });

    it("returns 404 for a non-existent product ID or slug", async () => {
      const res = await request(app)
        .get("/api/v1/assistant/catalog/product?id=non-existent-product-slug")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: {
          code: "not_found",
          message: "Product 'non-existent-product-slug' not found.",
        },
      });
    });

    it("returns complete product detail with live variant inventory by slug", async () => {
      const res = await request(app)
        .get(`/api/v1/assistant/catalog/product?id=${PROD_IN_STOCK_SLUG}`)
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: inStockProdId.toHexString(),
        slug: PROD_IN_STOCK_SLUG,
        name: "Loom Test ANC Headphones",
        category: TEST_CATEGORY,
        priceMinor: 12900,
        currency: "USD",
        inStock: true,
        availableQty: 13,
      });

      expect(Array.isArray(res.body.variants)).toBe(true);
      expect(res.body.variants).toHaveLength(2);

      const var1 = res.body.variants.find(
        (v: { name: string }) => v.name === "Matte Black",
      );
      expect(var1).toMatchObject({
        name: "Matte Black",
        priceMinor: 12900,
        currency: "USD",
        inStock: true,
        availableQty: 8, // 10 on hand - 2 reserved
        options: { Colour: "Matte Black" },
      });

      const var2 = res.body.variants.find(
        (v: { name: string }) => v.name === "Silver",
      );
      expect(var2).toMatchObject({
        name: "Silver",
        priceMinor: 13900,
        currency: "USD",
        inStock: true,
        availableQty: 5,
        options: { Colour: "Silver" },
      });
    });

    it("returns complete product detail by MongoDB ObjectId", async () => {
      const res = await request(app)
        .get(
          `/api/v1/assistant/catalog/product?id=${inStockProdId.toHexString()}`,
        )
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.slug).toBe(PROD_IN_STOCK_SLUG);
    });
  });

  describe("Security Boundaries", () => {
    it("does not allow bot token to access administrative routes", async () => {
      const res = await request(app)
        .get("/api/v1/admin/users")
        .set("Authorization", `Bearer ${TEST_TOKEN}`);

      // The admin route requires user authentication / session, not bot token
      expect(res.status).toBe(401);
    });
  });
});
