import request from "supertest";
import { createHash, randomBytes } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";
import { mergeGuestState } from "../src/routes/auth.js";

const app = createApp();

const suffix = randomBytes(4).toString("hex");
const productSlug = `wt-rev-product-${suffix}`;
// Dedicated rail fixtures so the recently-viewed test never depends on (or races with) the
// shared seeded catalogue while other test files run in parallel.
const railSlugA = `wt-rail-a-${suffix}`;
const railSlugB = `wt-rail-b-${suffix}`;
let reviewHelpfulId = new ObjectId();
let reviewPlainId = new ObjectId();
const uid = `wt-voter-${suffix}`;
const sessionToken = randomBytes(48).toString("base64url");
const csrfToken = randomBytes(24).toString("base64url");

async function insertFixture(): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const product = await db.collection("products").insertOne({
    slug: productSlug, name: "WaveTest Reviewable", brand: "WaveTest", category: "Wave Test", categorySlug: "wave-test-cat",
    priceMinor: 1_234, rating: 4.5, reviewCount: 2, imageUrl: "/catalog/x/01-800.webp", blurb: "synthetic review fixture", specs: [],
    state: "published", publishedAt: now, revision: 1, createdAt: now, updatedAt: now,
  });
  const inserted = await db.collection("reviews").insertMany([
    { productId: product.insertedId, userId: `wt-author-a-${suffix}`, orderId: null, rating: 5, title: "Great", body: "This is a long enough review body for the fixture.", verified: true, helpfulCount: 0, state: "published", createdAt: now, updatedAt: now },
    { productId: product.insertedId, userId: `wt-author-b-${suffix}`, orderId: null, rating: 4, title: "Good", body: "Another long enough review body for the fixture.", verified: false, helpfulCount: 2, state: "published", createdAt: new Date(now.getTime() - 1_000), updatedAt: now },
  ]);
  reviewHelpfulId = inserted.insertedIds[0] as ObjectId;
  reviewPlainId = inserted.insertedIds[1] as ObjectId;
  await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Wave Test Voter", roles: ["customer"], createdAt: now });
  await db.collection("sessions").insertOne({
    tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
    csrfHash: createHash("sha256").update(csrfToken).digest("hex"),
    familyId: randomBytes(12).toString("hex"), firebaseUid: uid, email: `${uid}@example.test`, displayName: "Wave Test Voter",
    expiresAt: new Date(Date.now() + 60_000), purgeAt: new Date(Date.now() + 60_000), createdAt: now,
  });
  for (const slug of [railSlugA, railSlugB]) {
    await db.collection("products").insertOne({
      slug, name: `WaveTest Rail ${slug}`, brand: "WaveTest", category: "Wave Test", categorySlug: "wave-test-cat",
      priceMinor: 5_000, rating: 4, reviewCount: 1, imageUrl: "/catalog/x/01-800.webp", blurb: "synthetic rail fixture", specs: [],
      state: "published", publishedAt: now, revision: 1, createdAt: now, updatedAt: now,
    });
  }
}

beforeAll(insertFixture, 30_000);

afterAll(async () => {
  const db = await getDb();
  const products = await db.collection("products").find({ slug: productSlug }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  await Promise.all([
    db.collection("reviews").deleteMany({ productId: { $in: products.map((product) => product._id) } }),
    db.collection("reviewVotes").deleteMany({ ownerKey: `user:${uid}` }),
    db.collection("recentlyViewed").deleteMany({ $or: [{ ownerKey: `user:${uid}` }, { ownerKey: { $regex: /^guest:wt-merge-/ } }] }),
    db.collection("guestMerges").deleteMany({ targetUserId: uid }),
    db.collection("sessions").deleteMany({ firebaseUid: uid }),
    db.collection("users").deleteOne({ firebaseUid: uid }),
    db.collection("products").deleteMany({ slug: { $in: [productSlug, railSlugA, railSlugB] } }),
  ]);
}, 30_000);

function voter() {
  return request(app)
    .post(`/api/v1/reviews/${reviewHelpfulId.toString()}/vote`)
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${sessionToken}`, `bazaar_csrf=${csrfToken}`])
    .set("x-csrf-token", csrfToken);
}

describe("review enhancements (API-03)", () => {
  it("returns verifiedPurchase, pseudonymous authorName, votedHelpful and a rating distribution summary", async () => {
    const response = await request(app).get(`/api/v1/products/${productSlug}/reviews`).expect(200);
    const reviews = response.body.data;
    expect(reviews).toHaveLength(2);
    const helpful = reviews.find((review: { id: string }) => review.id === reviewHelpfulId.toString());
    const plain = reviews.find((review: { id: string }) => review.id === reviewPlainId.toString());
    expect(helpful.verifiedPurchase).toBe(true);
    expect(plain.verifiedPurchase).toBe(false);
    expect(typeof helpful.authorName).toBe("string");
    expect(helpful.votedHelpful).toBe(false);
    expect(helpful.helpfulCount).toBe(0);
    expect(plain.helpfulCount).toBe(2);
    // data stays an array (backward compatible); the summary rides additive meta.
    expect(response.body.meta.summary.reviewCount).toBe(2);
    expect(response.body.meta.summary.rating).toBe(4.5);
    expect(response.body.meta.summary.distribution).toEqual({ "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 });
  }, 30_000);

  it("counts one vote per principal via the unique index, then supports un-voting", async () => {
    const first = await voter().send({}).expect(201);
    expect(first.body.data).toEqual({ helpfulCount: 1, votedHelpful: true });
    // Second vote must be idempotent — never a double increment.
    const second = await voter().send({}).expect(200);
    expect(second.body.data.alreadyVoted).toBe(true);
    expect(second.body.data.helpfulCount).toBe(1);
    const listed = await request(app)
      .get(`/api/v1/products/${productSlug}/reviews`)
      .set("Cookie", [`bazaar_session=${sessionToken}`, `bazaar_csrf=${csrfToken}`])
      .expect(200);
    const helpful = listed.body.data.find((review: { id: string }) => review.id === reviewHelpfulId.toString());
    expect(helpful.votedHelpful).toBe(true);
    const removed = await voter().send({ helpful: false }).expect(200);
    expect(removed.body.data).toEqual({ helpfulCount: 0, votedHelpful: false });
    const db = await getDb();
    expect(await db.collection("reviewVotes").countDocuments({ reviewId: reviewHelpfulId, ownerKey: `user:${uid}` })).toBe(0);
  }, 30_000);

  it("rejects guest votes with 401", async () => {
    const response = await request(app)
      .post(`/api/v1/reviews/${reviewPlainId.toString()}/vote`)
      .set("origin", config.webOrigin)
      .send({})
      .expect(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  }, 15_000);
});

describe("recently viewed rail (API-04)", () => {
  it("records views per guest, re-orders on re-view, honours exclude, and merges into the account without duplication", async () => {
    const db = await getDb();
    const slugs = [productSlug, railSlugA, railSlugB];

    const browser = request.agent(app);
    for (const slug of slugs) {
      await browser.post("/api/v1/viewed").set("origin", config.webOrigin).send({ slug }).expect(204);
    }
    let rail = await browser.get("/api/v1/viewed").expect(200);
    expect(rail.body.data.map((item: { slug: string }) => item.slug)).toEqual([...slugs].reverse());

    // Re-viewing the oldest moves it to the front instead of duplicating.
    await browser.post("/api/v1/viewed").set("origin", config.webOrigin).send({ slug: slugs[0] }).expect(204);
    rail = await browser.get("/api/v1/viewed").expect(200);
    expect(rail.body.data.map((item: { slug: string }) => item.slug)[0]).toBe(slugs[0]);
    expect(rail.body.data).toHaveLength(3);

    // The current product is excluded from its own rail.
    const excluded = await browser.get(`/api/v1/viewed?exclude=${slugs[0]}`).expect(200);
    expect(excluded.body.data.some((item: { slug: string }) => item.slug === slugs[0])).toBe(false);
    expect(excluded.body.data.every((item: { availability: string }) => typeof item.availability === "string")).toBe(true);

    // Guest → user merge: upsert semantics never duplicate a product seen on both sides.
    const guestHash = `wt-merge-${randomBytes(12).toString("hex")}`;
    const guestOwner = `guest:${guestHash}`;
    const userOwner = `user:${uid}`;
    const productDocs = await db.collection("products").find({ slug: { $in: slugs } }).project<{ _id: ObjectId; slug: string }>({ _id: 1, slug: 1 }).toArray();
    const idOf = (slug: string) => productDocs.find((product) => product.slug === slug)?._id as ObjectId;
    const base = Date.now() - 10_000;
    await db.collection("recentlyViewed").insertMany([
      { ownerKey: guestOwner, productId: idOf(slugs[0]!), viewedAt: new Date(base + 3_000), createdAt: new Date(base) },
      { ownerKey: guestOwner, productId: idOf(slugs[1]!), viewedAt: new Date(base + 4_000), createdAt: new Date(base) },
    ]);
    await db.collection("recentlyViewed").insertOne({ ownerKey: userOwner, productId: idOf(slugs[2]!), viewedAt: new Date(base + 1_000), createdAt: new Date(base) });

    const report = await mergeGuestState(db, guestHash, userOwner);
    expect(report.recentlyViewed).toBe(2);
    const merged = await db.collection("recentlyViewed").find({ ownerKey: userOwner }).toArray();
    expect(merged).toHaveLength(3);
    expect(new Set(merged.map((row) => row.productId.toString())).size).toBe(3);
    expect(await db.collection("recentlyViewed").countDocuments({ ownerKey: guestOwner })).toBe(0);

    // A replayed merge returns the stored report and does not duplicate anything.
    const replay = await mergeGuestState(db, guestHash, userOwner);
    expect(replay.recentlyViewed).toBe(2);
    expect(await db.collection("recentlyViewed").find({ ownerKey: userOwner }).toArray()).toHaveLength(3);
  }, 60_000);
});
