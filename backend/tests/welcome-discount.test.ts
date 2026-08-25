import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type Db } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";

const app = createApp();

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type BaseFixture = {
  ownerKey: string;
  productId: ObjectId;
  variantId: ObjectId;
  cartId: ObjectId;
};

type UserFixture = BaseFixture & {
  kind: "user";
  uid: string;
  email: string;
  session: { token: string; csrf: string };
};

type GuestFixture = BaseFixture & {
  kind: "guest";
  guestToken: string;
};

/** One purchasable product/variant/inventory trio priced at 40.00 so the maths stay legible. */
async function seedPurchasableVariant(db: Db) {
  const productId = new ObjectId();
  const variantId = new ObjectId();
  await db.collection("products").insertOne({
    _id: productId,
    slug: `welcome-${productId.toString()}`,
    name: "Welcome Test Product",
    brand: "Test Brand",
    category: "Test",
    categorySlug: "test",
    priceMinor: 4_000,
    rating: 0,
    reviewCount: 0,
    imageUrl: "/catalog/welcome-test.webp",
    blurb: "",
    specs: [],
    state: "published",
    publishedAt: new Date(),
    revision: 1,
  });
  await db.collection("variants").insertOne({
    _id: variantId,
    productId,
    sku: `WT-${variantId.toString()}`,
    name: "Standard",
    options: {},
    priceMinor: 4_000,
    state: "active",
  });
  await db.collection("inventory").insertOne({ variantId, onHand: 50, reserved: 0, version: 1, updatedAt: new Date() });
  return { productId, variantId };
}

async function seedCart(db: Db, key: string, variantId: ObjectId) {
  const inserted = await db.collection("carts").insertOne({
    ownerKey: key,
    revision: 1,
    lines: [{ variantId, quantity: 1 }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return inserted.insertedId;
}

/** Direct session seeding per tests/app.test.ts: cookie token + bound CSRF token. */
async function setupUser(): Promise<UserFixture> {
  const db = await getDb();
  const uid = `welcome-test-${randomBytes(8).toString("hex")}`;
  const email = `${uid}@example.test`;
  const { productId, variantId } = await seedPurchasableVariant(db);
  const cartId = await seedCart(db, `user:${uid}`, variantId);
  const token = randomBytes(48).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await db.collection("users").insertOne({ firebaseUid: uid, email, displayName: "Welcome Tester", roles: ["customer"], createdAt: new Date() });
  await db.collection("sessions").insertOne({
    tokenHash: sha256(token),
    csrfHash: sha256(csrf),
    familyId: randomBytes(12).toString("hex"),
    firebaseUid: uid,
    email,
    displayName: "Welcome Tester",
    expiresAt: new Date(Date.now() + 60_000),
    purgeAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  return { kind: "user", uid, email, ownerKey: `user:${uid}`, productId, variantId, cartId, session: { token, csrf } };
}

/** A deterministic guest identity: we own the cookie token, so we can compute its hash. */
async function setupGuest(): Promise<GuestFixture> {
  const db = await getDb();
  const guestToken = randomBytes(32).toString("base64url"); // 43 chars — matches the cookie pattern
  const ownerKey = `guest:${sha256(guestToken)}`;
  const { productId, variantId } = await seedPurchasableVariant(db);
  const cartId = await seedCart(db, ownerKey, variantId);
  return { kind: "guest", guestToken, ownerKey, productId, variantId, cartId };
}

async function teardown(fixture: BaseFixture & { kind: "user" | "guest"; uid?: string; session?: unknown; guestToken?: string }) {
  const db = await getDb();
  const ownerFilter = { ownerKey: fixture.ownerKey };
  await Promise.all([
    db.collection("orders").deleteMany(ownerFilter),
    db.collection("checkoutQuotes").deleteMany(ownerFilter),
    db.collection("reservations").deleteMany(ownerFilter),
    db.collection("carts").deleteMany(ownerFilter),
    db.collection("products").deleteOne({ _id: fixture.productId }),
    db.collection("variants").deleteMany({ productId: fixture.productId }),
    db.collection("inventory").deleteMany({ variantId: fixture.variantId }),
    ...(fixture.kind === "user"
      ? [db.collection("sessions").deleteMany({ firebaseUid: fixture.uid }), db.collection("users").deleteOne({ firebaseUid: fixture.uid })]
      : [db.collection("guestSessions").deleteOne({ tokenHash: sha256(fixture.guestToken ?? "") })]),
  ]);
}

function quoteAsUser(session: { token: string; csrf: string }) {
  return request(app)
    .post("/api/v1/orders/quote")
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${session.token}`, `bazaar_csrf=${session.csrf}`])
    .set("x-csrf-token", session.csrf)
    .send({ shippingMethod: "standard" });
}

function quoteAsGuest(guestToken: string) {
  return request(app)
    .post("/api/v1/orders/quote")
    .set("origin", config.webOrigin)
    .set("Cookie", `bazaar_guest=${guestToken}`)
    .send({ shippingMethod: "standard" });
}

describe("welcome discount (SSR-20)", () => {
  it("quotes a 5% welcome discount for a fresh authenticated shopper and stores it on the quote", async () => {
    const fixture = await setupUser();
    try {
      const response = await quoteAsUser(fixture.session).expect(201);
      const totals = response.body.data.totals;
      expect(totals.welcomeDiscount).toEqual({ amountMinor: 200, currency: "USD" });
      expect(totals.subtotal.amountMinor).toBe(4_000);
      expect(totals.discount.amountMinor).toBe(0); // promotion discount stays separate
      expect(totals.shipping.amountMinor).toBe(799); // 3 800 stays under the free-shipping floor
      expect(totals.tax.amountMinor).toBe(304); // round(3 800 × 0.08)
      expect(totals.total.amountMinor).toBe(4_903); // 3 800 + 799 + 304
      const stored = await (await getDb()).collection("checkoutQuotes").findOne({ _id: new ObjectId(response.body.data.id) });
      expect(stored?.["totals"]?.["welcomeDiscount"]).toEqual({ amountMinor: 200, currency: "USD" });
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("denies the welcome discount once any prior order exists — even a cancelled one", async () => {
    const fixture = await setupUser();
    try {
      const db = await getDb();
      await db.collection("orders").insertOne({
        ownerKey: fixture.ownerKey,
        idempotencyKey: randomBytes(12).toString("hex"),
        reference: `BZ-TEST-${randomBytes(4).toString("hex").toUpperCase()}`,
        state: "cancelled",
        lines: [],
        totals: {},
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const response = await quoteAsUser(fixture.session).expect(201);
      const totals = response.body.data.totals;
      expect(totals.welcomeDiscount).toBeUndefined();
      expect(totals.total.amountMinor).toBe(5_119); // full price: 4 000 + 799 + round(4 000 × 0.08)
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("never offers the welcome discount to guests", async () => {
    const fixture = await setupGuest();
    try {
      const response = await quoteAsGuest(fixture.guestToken).expect(201);
      expect(response.body.data.totals.welcomeDiscount).toBeUndefined();
      expect(response.body.data.totals.total.amountMinor).toBe(5_119);
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("refuses a stale discounted quote once an order snuck in between quote and create", async () => {
    const fixture = await setupUser();
    try {
      const db = await getDb();
      const quoted = await quoteAsUser(fixture.session).expect(201);
      expect(quoted.body.data.totals.welcomeDiscount).toEqual({ amountMinor: 200, currency: "USD" });
      // The disqualifying order lands AFTER the quote — checkout must not honour it.
      await db.collection("orders").insertOne({
        ownerKey: fixture.ownerKey,
        idempotencyKey: randomBytes(12).toString("hex"),
        reference: `BZ-TEST-${randomBytes(4).toString("hex").toUpperCase()}`,
        state: "confirmed",
        lines: [],
        totals: {},
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const attempt = await request(app)
        .post("/api/v1/orders/checkout")
        .set("origin", config.webOrigin)
        .set("Cookie", [`bazaar_session=${fixture.session.token}`, `bazaar_csrf=${fixture.session.csrf}`])
        .set("x-csrf-token", fixture.session.csrf)
        .set("idempotency-key", randomBytes(12).toString("hex"))
        .send({
          shipping: {
            fullName: "Welcome Tester",
            email: fixture.email,
            address1: "1 Test Way",
            city: "Testville",
            state: "TS",
            postalCode: "00000",
            country: "United States",
          },
          paymentMethod: "simulator",
          quoteId: quoted.body.data.id,
        })
        .expect(409);
      expect(attempt.body.code).toBe("PRICE_CHANGED");
      // Only the sneaked order exists — no discounted order was created.
      expect(await db.collection("orders").countDocuments({ ownerKey: fixture.ownerKey })).toBe(1);
    } finally {
      await teardown(fixture);
    }
  }, 30_000);
});
