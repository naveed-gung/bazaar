import request from "supertest";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";

const app = createApp();

const suffix = randomSuffix();
// Per-run category slugs isolate these fixtures from other test files' products that may run
// concurrently against the same dev database.
const WAVE_CAT = `wave-facet-cat-${suffix}`;
const OTHER_CAT = `other-facet-cat-${suffix}`;
type Synthetic = { slug: string; brand: string; categorySlug: string; priceMinor: number; rating: number; stock: number[]; optionPrices?: number[] };
const SYNTHETICS: Synthetic[] = [
  { slug: `wt-facet-alpha-${suffix}`, brand: "WaveTest", categorySlug: WAVE_CAT, priceMinor: 1_000, rating: 4.5, stock: [3, 2], optionPrices: [9_000, 9_500] },
  { slug: `wt-facet-beta-${suffix}`, brand: "WaveTest", categorySlug: WAVE_CAT, priceMinor: 2_000, rating: 3, stock: [20] },
  { slug: `wt-facet-gamma-${suffix}`, brand: "OtherBrand", categorySlug: OTHER_CAT, priceMinor: 300, rating: 4, stock: [0] },
  { slug: `wt-facet-delta-${suffix}`, brand: "OtherBrand", categorySlug: OTHER_CAT, priceMinor: 4_000, rating: 4, stock: [3] },
];

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function insertSynthetics(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  for (const item of SYNTHETICS) {
    const options = item.optionPrices ? [{ name: "Colour", values: ["Red", "Blue"] }] : [];
    const product = await db.collection("products").insertOne({
      slug: item.slug, name: `WaveTest ${item.slug}`, brand: item.brand, category: "Wave Test", categorySlug: item.categorySlug,
      priceMinor: item.priceMinor, rating: item.rating, reviewCount: 5, imageUrl: "/catalog/x/01-800.webp",
      ...(options.length ? { options } : {}), blurb: "synthetic facet fixture", specs: [],
      state: "published", publishedAt: now, revision: 1, createdAt: now, updatedAt: now,
    });
    const prices = item.optionPrices ?? [item.priceMinor];
    const variantIds: ObjectId[] = [];
    for (const [index, priceMinor] of prices.entries()) {
      const variantId = new ObjectId();
      variantIds.push(variantId);
      await db.collection("variants").insertOne({
        _id: variantId, productId: product.insertedId, sku: `WT-${item.slug}-${index}`.toUpperCase(),
        name: index === 0 ? "Red" : "Blue", ...(item.optionPrices ? { options: { Colour: index === 0 ? "Red" : "Blue" } } : {}),
        priceMinor, state: "active", createdAt: now, updatedAt: now,
      });
      await db.collection("inventory").insertOne({ variantId, onHand: item.stock[index] ?? 0, reserved: 0, version: 1, updatedAt: now });
    }
  }
}

afterAll(async () => {
  const db = await getDb();
  const slugs = SYNTHETICS.map((item) => item.slug);
  const products = await db.collection("products").find({ slug: { $in: slugs } }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  const variants = await db.collection("variants").find({ productId: { $in: products.map((product) => product._id) } }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  await Promise.all([
    db.collection("inventory").deleteMany({ variantId: { $in: variants.map((variant) => variant._id) } }),
    db.collection("variants").deleteMany({ productId: { $in: products.map((product) => product._id) } }),
    db.collection("products").deleteMany({ slug: { $in: slugs } }),
  ]);
}, 30_000);

beforeAll(insertSynthetics, 30_000);

describe("faceted catalogue query (API-01)", () => {
  it("returns facets alongside results and keeps backward-compatible pagination fields", async () => {
    const response = await request(app).get(`/api/v1/catalog/products?category=${WAVE_CAT}&limit=10`).expect(200);
    const body = response.body.data;
    expect(body.limit).toBe(10);
    expect(body.pageSize).toBe(10);
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.pages).toBe(Math.ceil(body.total / 10));
    for (const slug of SYNTHETICS.slice(0, 2).map((item) => item.slug)) {
      expect(body.items.some((item: { slug: string }) => item.slug === slug)).toBe(true);
    }
    // Brand counts reflect every OTHER active filter (the category), not the unfiltered set.
    expect(body.facets.brands).toEqual([{ value: "WaveTest", label: "WaveTest", count: 2 }]);
    // Category counts are computed WITHOUT the category filter, so both synthetic categories appear.
    const waveCatBucket = body.facets.categories.find((bucket: { value: string }) => bucket.value === WAVE_CAT);
    const otherCatBucket = body.facets.categories.find((bucket: { value: string }) => bucket.value === OTHER_CAT);
    expect(waveCatBucket?.count).toBe(2);
    expect(otherCatBucket?.count).toBe(2);
    // Price range spans the VARIANT price range of the filtered set (9000..9500), not base prices.
    expect(body.facets.priceMinor).toEqual({ min: 2_000, max: 9_500 });
    const colour = body.facets.options.find((option: { name: string }) => option.name === "Colour");
    expect(colour?.buckets).toEqual(expect.arrayContaining([
      { value: "Red", label: "Red", count: 1 },
      { value: "Blue", label: "Blue", count: 1 },
    ]));
  }, 30_000);

  it("filters on the variant price range rather than the base price alone", async () => {
    const response = await request(app).get(`/api/v1/catalog/products?minPrice=8000&limit=100`).expect(200);
    const slugs = response.body.data.items.map((item: { slug: string }) => item.slug);
    expect(slugs).toContain(SYNTHETICS[0]?.slug); // base 1000 but variants priced 9000/9500
    expect(slugs).not.toContain(SYNTHETICS[1]?.slug);
    expect(slugs).not.toContain(SYNTHETICS[3]?.slug);
  }, 30_000);

  it("maps availability filters to the availabilityOf thresholds", async () => {
    const outOfStock = await request(app).get(`/api/v1/catalog/products?availability=out_of_stock&limit=100`).expect(200);
    const outSlugs = outOfStock.body.data.items.map((item: { slug: string }) => item.slug);
    expect(outSlugs).toContain(SYNTHETICS[2]?.slug);
    expect(outSlugs).not.toContain(SYNTHETICS[1]?.slug);

    const lowStock = await request(app).get(`/api/v1/catalog/products?availability=low_stock&limit=100`).expect(200);
    const lowSlugs = lowStock.body.data.items.map((item: { slug: string }) => item.slug);
    expect(lowSlugs).toContain(SYNTHETICS[3]?.slug); // stock 3 → low
    expect(lowSlugs).toContain(SYNTHETICS[0]?.slug); // stock 3+2=5 → still low
    expect(lowSlugs).not.toContain(SYNTHETICS[2]?.slug); // stock 0 → out

    const inStock = await request(app).get(`/api/v1/catalog/products?availability=in_stock&limit=100`).expect(200);
    const inSlugs = inStock.body.data.items.map((item: { slug: string }) => item.slug);
    expect(inSlugs).toContain(SYNTHETICS[1]?.slug); // stock 20
    expect(inSlugs).not.toContain(SYNTHETICS[0]?.slug);
  }, 60_000);

  it("narrows results when filters combine (rating + category, brand + option)", async () => {
    const rated = await request(app).get(`/api/v1/catalog/products?rating=4&category=${WAVE_CAT}&limit=100`).expect(200);
    const ratedSlugs = rated.body.data.items.map((item: { slug: string }) => item.slug);
    expect(ratedSlugs).toContain(SYNTHETICS[0]?.slug); // rating 4.5
    expect(ratedSlugs).not.toContain(SYNTHETICS[1]?.slug); // rating 3

    const optioned = await request(app).get(`/api/v1/catalog/products?brand=WaveTest&option.Colour=Blue&limit=100`).expect(200);
    const optionedSlugs = optioned.body.data.items.map((item: { slug: string }) => item.slug);
    expect(optionedSlugs).toContain(SYNTHETICS[0]?.slug);
    expect(optionedSlugs).not.toContain(SYNTHETICS[1]?.slug); // no Colour option at all
  }, 60_000);

  it("rejects unknown or malformed filter params with 422", async () => {
    const cases: string[] = [
      "minPrice=abc",
      "maxPrice=-5",
      "minPrice=5000&maxPrice=100",
      "rating=9",
      "rating=high",
      "availability=nope",
      "sort=weird",
      "page=zero",
      `nonsense=${suffix}`,
    ];
    for (const query of cases) {
      const response = await request(app).get(`/api/v1/catalog/products?${query}`).expect(422);
      expect(["FILTER_INVALID", "UNKNOWN_FILTER"]).toContain(response.body.code);
    }
  }, 60_000);
});

describe("search suggestions (API-02)", () => {
  it("returns typed suggestions for a seeded prefix and logs one searchRequest", async () => {
    const db = await getDb();
    const before = await db.collection("searchRequests").countDocuments({ normalizedQuery: "nov" });
    const response = await request(app).get(`/api/v1/catalog/suggest?q=nov`).expect(200);
    expect(Array.isArray(response.body.data)).toBe(true);
    const products = response.body.data.filter((entry: { type: string }) => entry.type === "product");
    expect(products.length).toBeGreaterThan(0);
    for (const entry of response.body.data) {
      expect(["product", "category", "brand"]).toContain(entry.type);
    }
    for (const product of products) {
      expect(typeof product.slug).toBe("string");
      expect(typeof product.priceMinor).toBe("number");
    }
    // Fire-and-forget write: poll briefly instead of awaiting it inside the request.
    let after = before;
    for (let attempt = 0; attempt < 25 && after === before; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      after = await db.collection("searchRequests").countDocuments({ normalizedQuery: "nov" });
    }
    expect(after).toBeGreaterThan(before);
    // Cleanup only this test's log rows via its guest ownerKey.
    const cookie = String(response.headers["set-cookie"] ?? "");
    const token = /bazaar_guest=([A-Za-z0-9_-]+)/.exec(cookie)?.[1];
    if (token) {
      const ownerKey = `guest:${createHash("sha256").update(token).digest("hex")}`;
      await db.collection("searchRequests").deleteMany({ normalizedQuery: "nov", ownerKey });
    }
  }, 30_000);

  it("returns an empty list below the two-character minimum instead of an error", async () => {
    const response = await request(app).get(`/api/v1/catalog/suggest?q=N`).expect(200);
    expect(response.body.data).toEqual([]);
  }, 15_000);

  it("rejects oversized queries with 422", async () => {
    const response = await request(app).get(`/api/v1/catalog/suggest?q=${"x".repeat(101)}`).expect(422);
    expect(response.body.code).toBe("QUERY_TOO_LONG");
  }, 15_000);
});
