/**
 * Catalogue seeder. Turns CATEGORIES / PRODUCTS from catalog-data.ts plus the pinned
 * photography manifest in scripts/catalog-images.json into products, variants, inventory,
 * reviews, historical orders, returns and promotions.
 *
 * Determinism: every random-looking value comes from an FNV-1a seeded mulberry32 PRNG, so
 * two reseeds produce byte-identical documents. Generated history (reviews, orders,
 * returns, inventoryLedger) is tagged seeded: true and deleted before re-insert; long-lived
 * documents (categories, products, variants, inventory, promotions, users) upsert on their
 * natural key, which makes npm run db:seed idempotent.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectId, type Db } from "mongodb";
import { orderStates, SYSTEM_ROLES, type OrderState, type ProductImage, type SystemRoleKey } from "@bazaar/shared";
import type { Auth, UserRecord } from "firebase-admin/auth";
import { closeDatabase, getDb } from "./client.js";
import { applyDatabaseManifest } from "./manifest.js";
import { CATEGORIES, PRODUCTS, type ProductDefinition } from "./catalog-data.js";
import { calculateCheckoutTotals } from "../domain/checkout.js";
import { assertOrderTransition } from "../domain/order-state.js";
import { backfillLegacyUserRoles, seedSystemRoles } from "../domain/rbac.js";
import { logger } from "../logger.js";
import { config } from "../config.js";
import { firebaseAuth } from "../auth/firebase.js";

// ---------------------------------------------------------------- prng

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(fnv1a("bazaar-catalogue-seed-v1"));
const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const chance = (probability: number) => random() < probability;
const hex = (length: number) => Array.from({ length }, () => "0123456789ABCDEF".charAt(int(0, 15))).join("");

function pick<T>(items: readonly T[]): T {
  const item = items[int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list.");
  return item;
}

function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Index ${index} out of range.`);
  return item;
}

const money = (amountMinor: number) => ({ amountMinor, currency: "USD" as const });
const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------- images

type PinnedPhoto = {
  id: number;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
  src: string;
  alt: string;
};

const imageManifestPath = fileURLToPath(new URL("../../../scripts/catalog-images.json", import.meta.url));
const imageManifest = JSON.parse(readFileSync(imageManifestPath, "utf8")) as Record<string, PinnedPhoto[]>;
const IMAGE_WIDTHS = [400, 800, 1200] as const;

function imagesFor(product: ProductDefinition): ProductImage[] {
  const pinned = imageManifest[product.slug];
  if (!pinned?.length) {
    throw new Error(`No entry for "${product.slug}" in scripts/catalog-images.json. Run scripts/fetch-catalog-images.mjs before seeding.`);
  }
  return pinned.map((_, index) => {
    const ordinal = String(index + 1).padStart(2, "0");
    return {
      url: `/catalog/${product.slug}/${ordinal}-800.webp`,
      sources: IMAGE_WIDTHS.map((width) => ({ width, url: `/catalog/${product.slug}/${ordinal}-${width}.webp` })),
      alt: `${product.name} - photo ${index + 1}`,
      width: 800,
      height: 1000,
    };
  });
}

// ---------------------------------------------------------------- skus

const valueCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

function skuFor(slug: string, optionValues: readonly string[]): string {
  if (!optionValues.length) return `BZ-${slug.toUpperCase()}`;
  return `BZ-${slug.toUpperCase()}-${optionValues.map(valueCode).join("-")}`;
}

// ---------------------------------------------------------------- categories

async function seedCategories(db: Db, now: Date): Promise<void> {
  for (const category of CATEGORIES) {
    await db.collection("categories").updateOne(
      {
        slug: category.slug,
      },
      {
        $set: { name: category.name, blurb: category.blurb, imageUrl: `/catalog/${category.icon}`, state: "published", updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
}

// ---------------------------------------------------------------- catalogue

type SeededVariant = { variantId: ObjectId; sku: string; priceMinor: number };
type SeededProduct = { productId: ObjectId; slug: string; name: string; imageUrl: string; variants: SeededVariant[] };

async function seedCatalogue(db: Db, now: Date): Promise<{ variants: number; pruned: number; bySlug: Map<string, SeededProduct> }> {
  let variantCount = 0;
  let prunedCount = 0;
  const bySlug = new Map<string, SeededProduct>();

  for (const product of PRODUCTS) {
    const images = imagesFor(product);
    const hero = at(images, 0);

    const unset: Record<string, string> = {};
    if (!product.badge) unset.badge = "";
    if (!product.compareAtPriceMinor) unset.compareAtPriceMinor = "";

    const updated = await db.collection("products").findOneAndUpdate(
      { slug: product.slug },
      {
        $set: {
          name: product.name,
          brand: product.brand,
          category: product.category,
          categorySlug: product.categorySlug,
          priceMinor: product.priceMinor,
          ...(product.compareAtPriceMinor ? { compareAtPriceMinor: product.compareAtPriceMinor } : {}),
          rating: product.rating,
          reviewCount: product.reviewCount,
          imageUrl: hero.url,
          images,
          options: product.options.map((option) => ({ name: option.name, values: [...option.values] })),
          ...(product.badge ? { badge: product.badge } : {}),
          blurb: product.blurb,
          specs: product.specs.map(([label, value]) => ({ label, value })),
          state: "published",
          publishedAt: now,
          updatedAt: now,
        },
        $setOnInsert: { _id: new ObjectId(), revision: 1, createdAt: now },
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { upsert: true, returnDocument: "after" },
    );
    if (!updated) throw new Error(`Failed to seed product ${product.slug}`);
    const productId = updated._id;

    const desiredSkus = new Set<string>();
    const seededVariants: SeededVariant[] = [];
    for (const definition of product.variants) {
      const sku = skuFor(product.slug, definition.optionValues);
      if (desiredSkus.has(sku)) throw new Error(`Duplicate SKU "${sku}" generated for ${product.slug}.`);
      desiredSkus.add(sku);

      const options: Record<string, string> = {};
      definition.optionValues.forEach((value, index) => {
        const option = product.options[index];
        if (!option) throw new Error(`Variant of ${product.slug} references option index ${index} that does not exist.`);
        options[option.name] = value;
      });

      const priceMinor = product.priceMinor + (definition.priceDeltaMinor ?? 0);
      const variant = await db.collection("variants").findOneAndUpdate(
        { sku },
        {
          $set: {
            productId,
            name: definition.optionValues.join(" / ") || "Standard",
            options,
            priceMinor,
            imageIndex: definition.imageIndex ?? 0,
            state: "active",
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: "after" },
      );
      if (!variant) throw new Error(`Failed to seed variant ${sku}`);
      seededVariants.push({ variantId: variant._id, sku, priceMinor });

      // $set onHand from the catalogue and $inc version; reserved is left alone because a
      // live checkout quote may be holding units against this variant right now.
      await db.collection("inventory").updateOne(
        { variantId: variant._id },
        { $set: { onHand: definition.onHand, updatedAt: now }, $inc: { version: 1 }, $setOnInsert: { reserved: 0 } },
        { upsert: true },
      );
    }
    variantCount += seededVariants.length;

    // Prune variants whose SKU is no longer part of the catalogue (the legacy one-per-product
    // "Standard" rows) together with their orphaned inventory documents.
    const stale = await db.collection("variants").find({ productId, sku: { $nin: [...desiredSkus] } }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
    if (stale.length) {
      const staleIds = stale.map((item) => item._id);
      await db.collection("variants").deleteMany({ _id: { $in: staleIds } });
      await db.collection("inventory").deleteMany({ variantId: { $in: staleIds } });
      prunedCount += staleIds.length;
    }

    bySlug.set(product.slug, { productId, slug: product.slug, name: product.name, imageUrl: hero.url, variants: seededVariants });
  }

  return { variants: variantCount, pruned: prunedCount, bySlug };
}

// ---------------------------------------------------------------- reviews

const REVIEW_TITLES = [
  "Exactly what I hoped for",
  "Solid daily driver",
  "Better than expected",
  "Does the job well",
  "Worth the upgrade",
  "Mixed feelings",
  "Great value",
  "Impressive quality",
  "Almost perfect",
  "Happy with it",
  "Good but heavy",
  "Recommended",
];

const REVIEW_OPENERS = [
  "I have used this every day for a month and",
  "Out of the box it felt premium and",
  "After two weeks of heavy use",
  "Compared to my previous one",
  "Bought it during a sale and",
];

const REVIEW_DETAILS = [
  "the battery easily covers my workday",
  "the build quality feels a tier above the price",
  "setup took minutes and nothing has dropped since",
  "it handles everything I throw at it without complaint",
  "the finish still looks new despite daily carry",
  "support answered my question within a day",
  "the small details make it feel considered",
  "performance has been consistent, never throttling",
];

const REVIEW_CLOSERS = [
  "Would buy again without hesitating.",
  "Not flawless, but close enough that I stopped looking.",
  "For the price it is hard to beat.",
  "It earned a permanent spot on my desk.",
  "I would recommend it to friends, with minor caveats.",
  "Overall a very satisfying purchase.",
];

/** Reviewer identities are synthetic Firebase-UID-shaped strings; reviews never expose names. */
const REVIEWER_POOL = Array.from({ length: 64 }, (_, index) => `seed-reviewer-${String(index + 1).padStart(2, "0")}`);

function ratingNear(target: number): number {
  const roll = random();
  if (target >= 4.6) return roll < 0.72 ? 5 : roll < 0.94 ? 4 : 3;
  if (target >= 4.2) return roll < 0.55 ? 5 : roll < 0.88 ? 4 : 3;
  if (target >= 3.8) return roll < 0.35 ? 5 : roll < 0.75 ? 4 : 3;
  return roll < 0.2 ? 5 : roll < 0.55 ? 4 : roll < 0.85 ? 3 : 2;
}

/** Allocate roughly 200 reviews across products, weighted by their target popularity. */
function allocateReviewCounts(target: number): number[] {
  const weights = PRODUCTS.map((product) => Math.max(1, Math.round(Math.sqrt(product.reviewCount))));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const counts = weights.map((weight) => Math.max(1, Math.round((weight / totalWeight) * target)));
  let sum = counts.reduce((sum, count) => sum + count, 0);
  let guard = 0;
  while (sum !== target && guard < 10000) {
    guard += 1;
    const index = int(0, counts.length - 1);
    if (sum < target) {
      counts[index] = at(counts, index) + 1;
      sum += 1;
    } else if (at(counts, index) > 1) {
      counts[index] = at(counts, index) - 1;
      sum -= 1;
    }
  }
  return counts;
}

async function seedReviews(db: Db, now: Date): Promise<number> {
  await db.collection("reviews").deleteMany({ seeded: true });
  const counts = allocateReviewCounts(200);
  let reviewerCursor = 0;
  let inserted = 0;

  for (const [index, product] of PRODUCTS.entries()) {
    const count = at(counts, index);
    const productDoc = await db.collection("products").findOne({ slug: product.slug }, { projection: { _id: 1 } });
    if (!productDoc) throw new Error(`Product ${product.slug} missing before review seeding.`);
    const productId = productDoc._id;

    const reviews = [];
    for (let position = 0; position < count; position += 1) {
      const userId = at(REVIEWER_POOL, (reviewerCursor + position) % REVIEWER_POOL.length);
      const rating = ratingNear(product.rating);
      const createdAt = new Date(now.getTime() - int(1, 365) * DAY_MS - int(0, DAY_MS));
      reviews.push({
        productId,
        userId,
        orderId: null,
        rating,
        title: pick(REVIEW_TITLES),
        body: `${pick(REVIEW_OPENERS)} ${pick(REVIEW_DETAILS)}. ${pick(REVIEW_CLOSERS)}`,
        verified: chance(0.7),
        helpfulCount: int(0, 42),
        state: "published",
        createdAt,
        updatedAt: createdAt,
        seeded: true,
      });
    }
    reviewerCursor += count;
    if (reviews.length) await db.collection("reviews").insertMany(reviews);
    inserted += reviews.length;
  }
  return inserted;
}

/** Mirrors the aggregation admin review moderation runs, so moderating never jumps numbers. */
async function recomputeRatings(db: Db): Promise<void> {
  const summaries = await db.collection("reviews").aggregate<{ _id: ObjectId; rating: number; reviewCount: number }>([
    { $match: { state: "published" } },
    { $group: { _id: "$productId", rating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]).toArray();
  for (const summary of summaries) {
    await db.collection("products").updateOne({ _id: summary._id }, { $set: { rating: summary.rating, reviewCount: summary.reviewCount } });
  }
}

// ---------------------------------------------------------------- orders, returns, ledger

const ORDER_PATHS: Record<OrderState, readonly OrderState[]> = {
  awaiting_payment: ["awaiting_payment"],
  payment_failed: ["awaiting_payment", "payment_failed"],
  payment_confirmed: ["awaiting_payment", "payment_confirmed"],
  confirmed: ["awaiting_payment", "payment_confirmed", "confirmed"],
  processing: ["awaiting_payment", "payment_confirmed", "confirmed", "processing"],
  partially_fulfilled: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "partially_fulfilled"],
  fulfilled: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled"],
  shipped: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped"],
  partially_delivered: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "partially_delivered"],
  delivered: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered"],
  cancellation_requested: ["awaiting_payment", "payment_confirmed", "confirmed", "cancellation_requested"],
  cancelled: ["awaiting_payment", "payment_confirmed", "confirmed", "cancelled"],
  return_requested: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "return_requested"],
  return_approved: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "return_requested", "return_approved"],
  return_rejected: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "return_requested", "return_rejected"],
  returned: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "return_requested", "return_approved", "returned"],
  partially_refunded: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "return_requested", "return_approved", "returned", "partially_refunded"],
  refunded: ["awaiting_payment", "payment_confirmed", "confirmed", "cancelled", "refunded"],
  closed: ["awaiting_payment", "payment_confirmed", "confirmed", "processing", "fulfilled", "shipped", "delivered", "closed"],
};

function validateOrderPaths(): void {
  for (const state of orderStates) {
    const path = ORDER_PATHS[state];
    for (let index = 0; index < path.length - 1; index += 1) assertOrderTransition(at(path, index), at(path, index + 1));
  }
}

const SHIPPING_PRESETS = [
  { fullName: "Maya Haddad", email: "maya@example.com", address1: "14 Cedar Lane", address2: "", city: "Portland", state: "OR", postalCode: "97201", country: "United States" },
  { fullName: "Omar Nasser", email: "omar@example.com", address1: "88 Harbor View", address2: "Apt 4B", city: "Boston", state: "MA", postalCode: "02110", country: "United States" },
  { fullName: "Lena Fischer", email: "lena@example.com", address1: "5 Alder Court", address2: "", city: "Austin", state: "TX", postalCode: "78701", country: "United States" },
];

const CANCELLATION_REASONS = [
  "Found a better price elsewhere before dispatch.",
  "Ordered the wrong model by mistake.",
  "Delivery estimate no longer worked for me.",
];

const RETURN_REASONS = [
  "Arrived with a small dent on the casing.",
  "Not compatible with my existing setup.",
  "Changed my mind within the return window.",
  "Item does not match the listing photos.",
];

const RMA_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Return document state matching the admin transition table, keyed by final order state. */
const RETURN_STATE_BY_ORDER_STATE: Partial<Record<OrderState, { state: string; active: boolean }>> = {
  return_requested: { state: "requested", active: true },
  return_approved: { state: "approved", active: true },
  returned: { state: "received", active: true },
  partially_refunded: { state: "refunded", active: true },
  return_rejected: { state: "rejected", active: false },
  refunded: { state: "closed", active: false },
};

const EXTRA_ORDER_STATES: OrderState[] = [
  "delivered",
  "shipped",
  "processing",
  "confirmed",
  "cancelled",
  "fulfilled",
  "closed",
  "refunded",
  "awaiting_payment",
  "return_requested",
  "partially_delivered",
];

type HistoryResult = { orders: number; returns: number; ledgerEntries: number };

async function seedHistory(db: Db, now: Date, catalogue: Map<string, SeededProduct>): Promise<HistoryResult> {
  await Promise.all([
    db.collection("orders").deleteMany({ seeded: true }),
    db.collection("returns").deleteMany({ seeded: true }),
    db.collection("inventoryLedger").deleteMany({ seeded: true }),
  ]);

  const slugs = [...catalogue.keys()];
  const ownerKeys = [`user:${config.bootstrapClientUid}`, "user:seed-shopper-ava", "user:seed-shopper-noah", "user:seed-shopper-lena"].filter((key) => key !== "user:");
  const plan: OrderState[] = [...orderStates, ...EXTRA_ORDER_STATES];
  let ledgerEntries = 0;
  let returnCount = 0;

  for (const [index, finalState] of plan.entries()) {
    const path = ORDER_PATHS[finalState];
    const durations = path.map(() => int(6, 72) * 60 * 60 * 1000);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const start = now.getTime() - totalDuration - int(1, 90) * DAY_MS;
    let cursor = start;
    const timeline = path.map((step, stepIndex) => {
      const event = { state: step, at: new Date(cursor) };
      cursor += at(durations, stepIndex);
      return event;
    });
    const createdAt = new Date(start);
    const updatedAt = at(timeline, timeline.length - 1).at;

    const ownerKey = at(ownerKeys, index % ownerKeys.length);
    const idempotencyKey = `seed-order-${String(index + 1).padStart(2, "0")}`;
    const reference = `BZ-${now.getUTCFullYear()}-${hex(8)}`;

    const lineCount = int(1, 3);
    const usedSlugs = new Set<string>();
    const lines = [];
    for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
      let slug = pick(slugs);
      while (usedSlugs.has(slug)) slug = pick(slugs);
      usedSlugs.add(slug);
      const seededProduct = catalogue.get(slug);
      if (!seededProduct) throw new Error(`Seeded product ${slug} missing from catalogue map.`);
      const variant = pick(seededProduct.variants);
      const quantity = int(1, 2);
      lines.push({
        variantId: variant.variantId.toHexString(),
        productId: seededProduct.productId.toHexString(),
        slug: seededProduct.slug,
        name: seededProduct.name,
        imageUrl: seededProduct.imageUrl,
        quantity,
        unitPrice: money(variant.priceMinor),
        lineTotal: money(variant.priceMinor * quantity),
      });
    }

    const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotal.amountMinor, 0);
    const promotionCode = chance(0.25) ? "WELCOME10" : null;
    const totals = calculateCheckoutTotals(subtotalMinor, promotionCode ? { percentOff: 10, maxDiscountMinor: 5000 } : undefined);
    const paymentStatus = finalState === "payment_failed" ? "failed" : finalState === "awaiting_payment" ? "pending" : "confirmed";

    const order = {
      ownerKey,
      idempotencyKey,
      requestFingerprint: createHash("sha256").update(idempotencyKey).digest("hex"),
      reference,
      state: finalState,
      payment: { method: "simulator", status: paymentStatus, label: "Demo payment - no charge" },
      shipping: at(SHIPPING_PRESETS, index % SHIPPING_PRESETS.length),
      lines,
      totals: { subtotal: money(totals.subtotalMinor), discount: money(totals.discountMinor), shipping: money(totals.shippingMinor), tax: money(totals.taxMinor), total: money(totals.totalMinor) },
      promotionCode,
      timeline,
      ...(finalState === "cancelled" || finalState === "cancellation_requested" ? { cancellationReason: pick(CANCELLATION_REASONS) } : {}),
      createdAt,
      updatedAt,
      seeded: true,
    };
    const orderResult = await db.collection("orders").insertOne(order);

    for (const line of lines) {
      await db.collection("inventoryLedger").insertOne({
        variantId: new ObjectId(line.variantId),
        delta: -line.quantity,
        reason: "order",
        reference,
        idempotencyKey: `${ownerKey}:${idempotencyKey}:${line.variantId}`,
        createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
        seeded: true,
      });
      ledgerEntries += 1;
    }

    const returnPlan = RETURN_STATE_BY_ORDER_STATE[finalState];
    if (returnPlan) {
      const suffix = Array.from({ length: 12 }, () => RMA_ALPHABET.charAt(int(0, RMA_ALPHABET.length - 1))).join("");
      const stamp = createdAt.toISOString().slice(0, 10).replaceAll("-", "");
      const returnCreatedAt = new Date(Math.min(now.getTime() - DAY_MS, createdAt.getTime() + int(5, 20) * DAY_MS));
      // activeOrderId is omitted entirely for terminal returns: the unique sparse index treats
      // explicit nulls as values, so two closed returns would collide on it.
      await db.collection("returns").insertOne({
        reference: `RMA-${stamp}-${suffix}`,
        orderId: orderResult.insertedId,
        ...(returnPlan.active ? { activeOrderId: orderResult.insertedId } : {}),
        ownerKey,
        reason: pick(RETURN_REASONS),
        resolution: chance(0.3) ? "replacement" : "refund",
        state: returnPlan.state,
        createdAt: returnCreatedAt,
        updatedAt: returnCreatedAt,
        seeded: true,
      });
      returnCount += 1;
    }
  }
  return { orders: plan.length, returns: returnCount, ledgerEntries };
}

// ---------------------------------------------------------------- promotions

const PROMOTIONS = [
  { code: "SAVE5", name: "Five percent off", percentOff: 5, maxDiscountMinor: 2000 },
  { code: "SPRING15", name: "Spring sale 15%", percentOff: 15, maxDiscountMinor: 10000 },
  { code: "BIGDEAL20", name: "Big deal 20%", percentOff: 20, maxDiscountMinor: 15000 },
  { code: "VIP25", name: "VIP 25%", percentOff: 25, maxDiscountMinor: 20000 },
  { code: "FLASH30", name: "Flash weekend 30%", percentOff: 30, maxDiscountMinor: 25000 },
  { code: "LOYAL10", name: "Loyalty 10%", percentOff: 10 },
];

async function seedPromotions(db: Db, now: Date): Promise<void> {
  const definitions = [
    { code: "WELCOME10", name: "Welcome 10%", percentOff: 10, maxDiscountMinor: 5000 },
    ...PROMOTIONS,
  ];
  for (const promotion of definitions) {
    await db.collection("promotions").updateOne(
      { code: promotion.code },
      {
        $set: {
          name: promotion.name,
          kind: "percentage",
          percentOff: promotion.percentOff,
          ...(promotion.maxDiscountMinor ? { maxDiscountMinor: promotion.maxDiscountMinor } : {}),
          state: "active",
          startsAt: new Date("2024-01-01T00:00:00.000Z"),
          endsAt: new Date("2030-01-01T00:00:00.000Z"),
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
}

// ---------------------------------------------------------------- shipping methods

/**
 * API-06: the shippingMethods collection replaces the hardcoded shipping literals. Standard
 * pins today's economics exactly — 799 minor units, free over a 5 000 minor discounted
 * subtotal — so existing behaviour is unchanged by default (backend/tests/checkout.test.ts).
 */
type ShippingMethodSeed = {
  key: string;
  name: string;
  description: string;
  rateMinor: number;
  freeOverMinor?: number;
  etaDays: [number, number];
};

const SHIPPING_METHODS: ShippingMethodSeed[] = [
  { key: "standard", name: "Standard delivery", description: "Free over $50 · otherwise $7.99 flat rate", rateMinor: 799, freeOverMinor: 5_000, etaDays: [3, 7] },
  { key: "express", name: "Express delivery", description: "Fast courier at a flat rate", rateMinor: 1_999, etaDays: [1, 3] },
  { key: "pickup", name: "Depot pickup", description: "Collect your order from the Bazaar depot", rateMinor: 0, etaDays: [1, 2] },
];

async function seedShippingMethods(db: Db, now: Date): Promise<void> {
  for (const method of SHIPPING_METHODS) {
    await db.collection("shippingMethods").updateOne(
      { key: method.key },
      {
        $set: {
          name: method.name,
          description: method.description,
          rateMinor: method.rateMinor,
          ...(method.freeOverMinor !== undefined ? { freeOverMinor: method.freeOverMinor } : {}),
          etaDays: method.etaDays,
          state: "active",
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
}

// ---------------------------------------------------------------- accounts

const SHOPPER_ACCOUNTS = [
  { firebaseUid: "seed-shopper-ava", email: "seed-shopper-ava@example.com", displayName: "Ava Seeder" },
  { firebaseUid: "seed-shopper-noah", email: "seed-shopper-noah@example.com", displayName: "Noah Seeder" },
  { firebaseUid: "seed-shopper-lena", email: "seed-shopper-lena@example.com", displayName: "Lena Seeder" },
];

/**
 * Demo staff identities for each non-owner back-office role. Like the shoppers, they are
 * Mongo documents keyed by synthetic Firebase UIDs — no credentials are created or stored
 * anywhere in this repo; grant a real Firebase user these role keys via the RBAC API to
 * sign in with them.
 */
const STAFF_ACCOUNTS = [
  { firebaseUid: "seed-staff-ops", email: "seed-staff-ops@example.com", displayName: "Opal Seeder", roles: ["ops"] },
  { firebaseUid: "seed-staff-support", email: "seed-staff-support@example.com", displayName: "Sana Seeder", roles: ["support"] },
];

async function seedAccounts(db: Db, now: Date): Promise<void> {
  const adminUid = config.bootstrapAdminUid || (config.isProduction ? "" : "dev-owner-uid");
  const adminEmail = config.bootstrapAdminEmail || (config.isProduction ? "" : "admin@bazaar.dev");
  const clientUid = config.bootstrapClientUid || (config.isProduction ? "" : "dev-customer-uid");
  const clientEmail = config.bootstrapClientEmail || (config.isProduction ? "" : "client@bazaar.dev");

  const accounts = [
    { firebaseUid: config.bootstrapAdminUid, email: config.bootstrapAdminEmail, displayName: "Bazaar Admin", roles: ["owner"] },
    { firebaseUid: config.bootstrapClientUid, email: config.bootstrapClientEmail, displayName: "Bazaar Client", roles: ["customer"] },
    { firebaseUid: adminUid, email: adminEmail, displayName: "Bazaar Admin", roles: ["owner"] },
    { firebaseUid: clientUid, email: clientEmail, displayName: "Bazaar Client", roles: ["customer"] },
    ...STAFF_ACCOUNTS,
    ...SHOPPER_ACCOUNTS.map((shopper) => ({ ...shopper, roles: ["customer"] })),
  ];
  for (const account of accounts) {
    if (!account.firebaseUid || !account.email) throw new Error("Bootstrap Firebase UID and email pairs are required.");
    if (!account.firebaseUid || !account.email) {
      if (config.isProduction) {
        throw new Error("Bootstrap Firebase UID and email pairs are required.");
      }
      continue;
    }
    await db.collection("users").updateOne(
      { firebaseUid: account.firebaseUid },
      { $set: { email: account.email, displayName: account.displayName, roles: [...account.roles], updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
}

// ---------------------------------------------------------------- dev RBAC logins (SSR-26)

/**
 * DEV-ONLY fixed password shared by every seeded RBAC login below.
 *
 * ⚠️⚠️ DEVELOPMENT SEED CREDENTIAL — it exists so each system role can be signed into through
 * the normal /login form against a local/dev Firebase project. It MUST NOT exist in any
 * production system: `seedRbacLogins` refuses to provision these accounts when NODE_ENV is
 * "production", and they must be deleted from any shared/staging Firebase project that faces
 * real users.
 */
const DEV_ONLY_PASSWORD = "Bazaar#Dev2026";

/** One working login per system role, plus a second customer for multi-account checks. */
const RBAC_LOGIN_SEEDS = [
  { email: "owner@bazaar.dev", displayName: "Dev Owner", role: "owner" },
  { email: "ops@bazaar.dev", displayName: "Dev Ops", role: "ops" },
  { email: "support@bazaar.dev", displayName: "Dev Support", role: "support" },
  { email: "customer@bazaar.dev", displayName: "Dev Customer", role: "customer" },
  { email: "customer2@bazaar.dev", displayName: "Dev Customer Two", role: "customer" },
] as const satisfies readonly { email: string; displayName: string; role: SystemRoleKey }[];

/** `getUserByEmail` rejects with auth/user-not-found instead of resolving null; normalise that. */
function findFirebaseUserByEmail(auth: Auth, email: string): Promise<UserRecord | null> {
  return auth.getUserByEmail(email).catch((error: unknown) => {
    if ((error as { code?: string } | null)?.code === "auth/user-not-found") return null;
    throw error;
  });
}

/**
 * Idempotent Firebase Auth provisioning (SSR-29, loud): create the user only when neither uid
 * nor email is known; otherwise leave credentials (the password!) untouched and sync just the
 * displayName. A second run therefore performs no credential writes at all. Reports whether the
 * identity was CREATED or merely FOUND so the caller can log each account's outcome.
 */
async function ensureFirebaseUser(
  auth: Auth,
  seed: (typeof RBAC_LOGIN_SEEDS)[number],
): Promise<{ user: UserRecord; created: boolean }> {
  const existing = await findFirebaseUserByEmail(auth, seed.email);
  if (existing) {
    const user =
      existing.displayName === seed.displayName
        ? existing
        : await auth.updateUser(existing.uid, { displayName: seed.displayName });
    return { user, created: false };
  }
  const user = await auth.createUser({ email: seed.email, password: DEV_ONLY_PASSWORD, displayName: seed.displayName, emailVerified: true });
  return { user, created: true };
}

/** Only ever logged/printed field pair — project IDs are not secrets. */
function readProjectIdFromServiceAccount(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as { project_id?: unknown };
    return typeof parsed.project_id === "string" && parsed.project_id ? parsed.project_id : null;
  } catch {
    return null;
  }
}

/**
 * Mirrors firebase.ts's Admin-credential resolution order WITHOUT initializing an app, so the
 * seeder can name the project the credentials belong to (SSR-29 mismatch guard). Null when
 * nothing resolvable is configured.
 */
function resolveAdminProjectId(): string | null {
  if (config.firebaseProjectId) return config.firebaseProjectId;
  const explicit = config.firebaseAdminCredentials || process.env["GOOGLE_APPLICATION_CREDENTIALS"] || "";
  if (explicit.trimStart().startsWith("{")) return readProjectIdFromServiceAccount(explicit);
  if (explicit && existsSync(explicit)) return readProjectIdFromServiceAccount(readFileSync(explicit, "utf8"));
  const localCredential = [path.resolve(process.cwd()), path.resolve(process.cwd(), "..")]
    .flatMap((directory) => (existsSync(directory) ? readdirSync(directory).map((name) => path.join(directory, name)) : []))
    .find((candidate) => candidate.includes("firebase-adminsdk") && candidate.endsWith(".json"));
  if (localCredential) return readProjectIdFromServiceAccount(readFileSync(localCredential, "utf8"));
  return null;
}

/**
 * SSR-29 PROJECT-MISMATCH GUARD: seeded accounts sign in through the FRONTEND's Firebase web
 * config (VITE_FIREBASE_PROJECT_ID), not through the Admin SDK's project. When the two differ —
 * or either side is unknown — say so loudly instead of letting owner@bazaar.dev answer Firebase
 * `400 auth/invalid-credential` with no explanation. Only non-secret project IDs are printed.
 */
function warnOnFirebaseProjectMismatch(adminProjectId: string | null): void {
  const frontendProjectId = process.env["VITE_FIREBASE_PROJECT_ID"] ?? null;
  if (!adminProjectId || !frontendProjectId) {
    logger.info(
      { adminProjectId, frontendProjectId },
      "Firebase project cross-check skipped: one side could not be resolved.",
    );
    return;
  }
  if (adminProjectId !== frontendProjectId) {
    console.warn(
      `⚠️  FIREBASE PROJECT MISMATCH: Admin credentials target "${adminProjectId}" but the frontend web app uses "${frontendProjectId}". Seeded accounts will NOT sign in on this frontend.`,
    );
    logger.warn(
      { adminProjectId, frontendProjectId },
      "Seeded accounts will NOT sign in on this frontend: Admin project differs from VITE_FIREBASE_PROJECT_ID.",
    );
    return;
  }
  logger.info({ projectId: adminProjectId }, "Firebase project cross-check passed: Admin credentials match the frontend web app.");
}

/**
 * DEV ONLY. Ensures one sign-in-able account per system role: a real Firebase Auth user
 * (email + DEV_ONLY_PASSWORD) plus the Mongo user document bound to that real Firebase UID,
 * carrying the role key in exactly the shape middleware/auth.ts resolves permissions from
 * (`users.roles` → resolvePermissions → req.principal.permissions).
 *
 * SSR-29: every account logs its outcome LOUDLY — firebase "created"/"found" (with uid), or
 * "skipped" with the reason. Without Admin credentials the Mongo documents are STILL bound
 * (stable synthetic UIDs keep re-runs idempotent) but they are MONGO-ONLY and cannot
 * authenticate; a final ⚠️ summary line says exactly that. Skipped entirely — with a warning,
 * never a throw — when NODE_ENV is production. Existing users' passwords are never touched.
 * Returns true only when every login received a REAL Firebase identity.
 */
async function seedRbacLogins(db: Db, now: Date): Promise<boolean> {
  const emails = RBAC_LOGIN_SEEDS.map((seed) => seed.email);
  if (config.isProduction) {
    logger.warn({ emails }, "DEV-ONLY RBAC logins skipped: NODE_ENV is production — fixed-password development seeds must never be created here.");
    return false;
  }
  warnOnFirebaseProjectMismatch(resolveAdminProjectId());
  const auth = firebaseAuth();
  if (!auth) {
    const mongoOnly: string[] = [];
    for (const seed of RBAC_LOGIN_SEEDS) {
      const syntheticUid = `dev-${seed.role}-${seed.email.split("@")[0]}`;
      await db.collection("users").updateOne(
        { firebaseUid: syntheticUid },
        { $set: { email: seed.email, displayName: seed.displayName, roles: [seed.role], updatedAt: now }, $setOnInsert: { createdAt: now } },
        { upsert: true },
      );
      logger.warn({ email: seed.email, role: seed.role, firebaseUser: "skipped", reason: "no-admin-credentials", mongoUid: syntheticUid }, "DEV-ONLY RBAC login seeded as a MONGO-ONLY document — it CANNOT sign in until Firebase Admin credentials are configured.");
      mongoOnly.push(seed.email);
    }
    console.warn(`⚠️  ${mongoOnly.length}/${RBAC_LOGIN_SEEDS.length} seeded accounts have NO Firebase identity (${mongoOnly.join(", ")}) — Mongo documents only; they CANNOT sign in via /login.`);
    return false;
  }
  for (const seed of RBAC_LOGIN_SEEDS) {
    const { user, created } = await ensureFirebaseUser(auth, seed);
    logger.info({ email: seed.email, role: seed.role, firebaseUser: created ? "created" : "found", uid: user.uid }, "DEV-ONLY RBAC login Firebase identity ready (existing passwords never touched).");
    await db.collection("users").updateOne(
      { firebaseUid: user.uid },
      { $set: { email: seed.email, displayName: seed.displayName, roles: [seed.role], updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }
  return true;
}

function rbacPermissionSummary(role: SystemRoleKey): string {
  const permissions = SYSTEM_ROLES.find((definition) => definition.key === role)?.permissions ?? [];
  return permissions.length ? permissions.join(", ") : "(none)";
}

/** Prints the seeded dev logins after a successful seed. Console-only; pino logs stay secret-free. */
function printRbacLoginTable(): void {
  console.table(
    RBAC_LOGIN_SEEDS.map((seed) => ({
      email: seed.email,
      password: `${DEV_ONLY_PASSWORD} (DEV ONLY)`,
      role: seed.role,
      permissions: rbacPermissionSummary(seed.role),
    })),
  );
}

// ---------------------------------------------------------------- main

async function main() {
  const db = await getDb();
  await applyDatabaseManifest(db);
  const now = new Date();

  validateOrderPaths();
  await seedCategories(db, now);
  const catalogue = await seedCatalogue(db, now);
  const reviews = await seedReviews(db, now);
  await recomputeRatings(db);
  const history = await seedHistory(db, now, catalogue.bySlug);
  await seedPromotions(db, now);
  await seedShippingMethods(db, now);
  const systemRoles = await seedSystemRoles(db);
  await seedAccounts(db, now);
  const rbacLoginsSeeded = await seedRbacLogins(db, now);
  const backfill = await backfillLegacyUserRoles(db);

  logger.info(
    {
      products: PRODUCTS.length,
      categories: CATEGORIES.length,
      variants: catalogue.variants,
      reviews,
      orders: history.orders,
      returns: history.returns,
      pruned: catalogue.pruned,
      shippingMethods: SHIPPING_METHODS.length,
      systemRoles,
      rbacLogins: rbacLoginsSeeded ? RBAC_LOGIN_SEEDS.length : 0,
      legacyRolesRenamed: backfill.adminsRenamed + backfill.clientsRenamed,
    },
    "catalog seed complete",
  );
  if (rbacLoginsSeeded) printRbacLoginTable();
  await closeDatabase();
}

void main().catch((error) => {
  logger.fatal({ err: error }, "catalog seed failed");
  process.exitCode = 1;
});
void main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    logger.fatal({ err: error }, "catalog seed failed");
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
