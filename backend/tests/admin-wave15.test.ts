/**
 * Wave 1.5 integration coverage for API-05 and API-07…API-12 (docs/agent/07-backend-api.md):
 * the admin product editor, promotions CRUD, categories CRUD with its delete guard, order
 * detail + snapshot-sourced invoice, analytics, and stock alerts with audit-only restock
 * resolution. Follows the supertest harness from rbac.test.ts against the configured dev DB.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";
import { seedSystemRoles } from "../src/domain/rbac.js";

const app = createApp();

type TestPrincipal = { uid: string; token: string; csrf: string };
type MutatingMethod = "post" | "patch" | "put" | "delete";

const createdPrincipals: TestPrincipal[] = [];
const productIds: ObjectId[] = [];
const promotionCodes: string[] = [];
const categorySlugs: string[] = [];
const orderReferences: string[] = [];

const run = randomBytes(4).toString("hex");

async function createPrincipal(roles: string[]): Promise<TestPrincipal> {
  const db = await getDb();
  const uid = `wave15-${run}-${randomBytes(6).toString("hex")}`;
  const token = randomBytes(48).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Wave 1.5 Test", roles: [...roles], createdAt: new Date() });
  await db.collection("sessions").insertOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    csrfHash: createHash("sha256").update(csrf).digest("hex"),
    familyId: randomBytes(12).toString("hex"),
    firebaseUid: uid,
    email: `${uid}@example.test`,
    displayName: "Wave 1.5 Test",
    roles: [...roles],
    expiresAt: new Date(Date.now() + 60_000),
    purgeAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  const principal = { uid, token, csrf };
  createdPrincipals.push(principal);
  return principal;
}

function readAs(principal: TestPrincipal, url: string) {
  return request(app).get(url).set("cookie", `bazaar_session=${principal.token}`);
}

function mutateAs(principal: TestPrincipal, method: MutatingMethod, url: string) {
  return request(app)[method](url)
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${principal.token}`, `bazaar_csrf=${principal.csrf}`])
    .set("x-csrf-token", principal.csrf);
}

let owner: TestPrincipal;
let customer: TestPrincipal;
let stranger: TestPrincipal;

beforeAll(async () => {
  await seedSystemRoles(await getDb());
  owner = await createPrincipal(["owner"]);
  customer = await createPrincipal(["customer"]);
  stranger = await createPrincipal(["customer"]);
});

afterAll(async () => {
  const db = await getDb();
  const uids = createdPrincipals.map((principal) => principal.uid);
  await Promise.all([
    db.collection("sessions").deleteMany({ firebaseUid: { $in: uids } }),
    db.collection("users").deleteMany({ firebaseUid: { $in: uids } }),
    db.collection("products").deleteMany({ _id: { $in: productIds } }),
    db.collection("variants").deleteMany({ productId: { $in: productIds } }),
    db.collection("inventory").deleteMany({ variantId: { $in: productIds } }),
    db.collection("stockAlerts").deleteMany({ productId: { $in: productIds } }),
    db.collection("promotions").deleteMany({ code: { $in: promotionCodes } }),
    db.collection("categories").deleteMany({ slug: { $in: categorySlugs } }),
    db.collection("orders").deleteMany({ reference: { $in: orderReferences } }),
    db.collection("auditLogs").deleteMany({ $or: [{ actorId: { $in: uids } }, { entityId: { $in: productIds.map(String).concat(promotionCodes, categorySlugs, orderReferences) } }] }),
  ]);
});

/** Creates a published scratch product through the editor API itself; returns ids. */
async function createScratchProduct(principal: TestPrincipal, overrides: Record<string, unknown> = {}) {
  const slug = `wave15-${run}-${randomBytes(3).toString("hex")}`;
  const response = await mutateAs(principal, "post", "/api/v1/admin/products")
    .send({
      slug,
      name: "Wave15 Probe Product",
      brand: "Probe Labs",
      category: "Probes",
      categorySlug: "probes",
      priceMinor: 4999,
      imageUrl: `/catalog/${slug}/01-800.webp`,
      blurb: "A disposable product created by the wave 1.5 integration suite.",
      state: "published",
      ...overrides,
    })
    .expect(201);
  productIds.push(new ObjectId(response.body.data.id));
  return response.body.data as { id: string; slug: string; revision: number; variants: { id: string; sku: string }[] };
}

describe("API-07 admin product editor", () => {
  it("creates a product with specs, gallery, options and variants — each variant born with an inventory document", async () => {
    const created = await createScratchProduct(owner, {
      specs: [{ label: "Battery", value: "20 000 mAh" }],
      images: [
        { url: `/catalog/wave15-${run}/01-800.webp`, alt: "Front" },
        { url: `/catalog/wave15-${run}/02-800.webp`, alt: "Back" },
      ],
      options: [
        { name: "Colour", values: ["Graphite", "Sand"] },
        { name: "Pack", values: ["Solo", "Duo"] },
      ],
      variants: [
        { optionValues: ["Graphite", "Solo"], onHand: 5 },
        { optionValues: ["Graphite", "Duo"], priceMinor: 8999, onHand: 0 },
        { optionValues: ["Sand", "Solo"], onHand: 12 },
        { optionValues: ["Sand", "Duo"], priceMinor: 8999, onHand: 2 },
      ],
    });
    expect(created.variants).toHaveLength(4);
    const detail = await readAs(owner, `/api/v1/admin/products/${created.id}`).expect(200);
    expect(detail.body.data.specs).toEqual([{ label: "Battery", value: "20 000 mAh" }]);
    expect(detail.body.data.images).toHaveLength(2);
    expect(detail.body.data.options).toHaveLength(2);
    expect(detail.body.data.variants).toHaveLength(4);
    for (const variant of detail.body.data.variants) expect(variant.stockVersion).toBe(1);
    // Multi-price products keep their spread when the base price changes — the legacy
    // flatten-everything cascade must not touch seeded-style variant pricing.
    await mutateAs(owner, "patch", `/api/v1/admin/products/${created.id}`).send({ revision: created.revision, priceMinor: 5999 }).expect(200);
    const after = await readAs(owner, `/api/v1/admin/products/${created.id}`).expect(200);
    const prices = after.body.data.variants.map((variant: { priceMinor: number }) => variant.priceMinor).sort((a: number, b: number) => a - b);
    expect(prices).toEqual([4999, 4999, 8999, 8999]);
    // Legacy uniform products (every active variant still tracking the base price) DO cascade.
    const plain = await createScratchProduct(owner);
    await mutateAs(owner, "patch", `/api/v1/admin/products/${plain.id}`).send({ revision: plain.revision, priceMinor: 5999 }).expect(200);
    const plainDetail = await readAs(owner, `/api/v1/admin/products/${plain.id}`).expect(200);
    expect(plainDetail.body.data.variants[0].priceMinor).toBe(5999);
  }, 60_000);

  it("rejects non-media gallery URLs and inconsistent variant option values with 422", async () => {
    await mutateAs(owner, "post", "/api/v1/admin/products")
      .send({
        slug: `wave15-bad-${run}`, name: "Bad Gallery", brand: "Probe Labs", category: "Probes", categorySlug: "probes",
        priceMinor: 1000, imageUrl: `/catalog/wave15-bad/01-800.webp`, blurb: "Trying to smuggle an external image URL in.",
        images: [{ url: "https://evil.example/track.webp" }],
      })
      .expect(422)
      .then((response) => expect(response.body.code).toBe("MEDIA_URL_INVALID"));
    const base = { slug: `wave15-mismatch-${run}`, name: "Mismatch Probe", brand: "Probe Labs", category: "Probes", categorySlug: "probes", priceMinor: 1000, imageUrl: `/catalog/wave15-x/01-800.webp`, blurb: "Option consistency must be validated on create too." };
    await mutateAs(owner, "post", "/api/v1/admin/products")
      .send({ ...base, options: [{ name: "Size", values: ["S", "M"] }], variants: [{ optionValues: ["L"] }] })
      .expect(422)
      .then((response) => expect(response.body.code).toBe("VALIDATION_FAILED"));
  }, 60_000);

  it("supports variant add/update/archive operations transactionally and archives never delete", async () => {
    const created = await createScratchProduct(owner, {
      options: [{ name: "Size", values: ["S", "M"] }],
      variants: [{ optionValues: ["S"], onHand: 3 }],
    });
    const variantId = created.variants[0]?.id;
    expect(variantId).toBeDefined();
    // Wrong revision → optimistic concurrency conflict.
    await mutateAs(owner, "patch", `/api/v1/admin/products/${created.id}`).send({ revision: 999, name: "Conflict Probe" }).expect(409).then((response) => expect(response.body.code).toBe("REVISION_CONFLICT"));
    // Add a second variant + update the first in one call.
    const patched = await mutateAs(owner, "patch", `/api/v1/admin/products/${created.id}`)
      .send({ revision: created.revision, variants: { add: [{ optionValues: ["M"], sku: `WAVE15-${run}-M`, onHand: 7 }], update: [{ id: variantId, name: "Small", priceMinor: 4500 }] } })
      .expect(200);
    expect(patched.body.data.variants).toMatchObject({ added: 1, updated: 1 });
    // Archive the added variant — state change only, inventory document untouched.
    const detail = await readAs(owner, `/api/v1/admin/products/${created.id}`).expect(200);
    const added = detail.body.data.variants.find((variant: { sku: string }) => variant.sku === `WAVE15-${run.toUpperCase()}-M`);
    expect(added.state).toBe("active");
    await mutateAs(owner, "delete", `/api/v1/admin/products/${created.id}/variants/${added.id}`).expect(200);
    const afterArchive = await readAs(owner, `/api/v1/admin/products/${created.id}`).expect(200);
    const archivedVariant = afterArchive.body.data.variants.find((variant: { id: string }) => variant.id === added.id);
    expect(archivedVariant.state).toBe("archived");
    expect(archivedVariant.onHand).toBe(7); // inventory row survives the archive
    // Customer is denied the whole editor surface.
    await mutateAs(customer, "patch", `/api/v1/admin/products/${created.id}`).send({ revision: 1, name: "Nope" }).expect(403).then((response) => expect(response.body.meta.missingPermission).toBe("catalog:write"));
  }, 60_000);

  it("archives a product instead of deleting it, idempotently", async () => {
    const created = await createScratchProduct(owner);
    await mutateAs(owner, "delete", `/api/v1/admin/products/${created.id}`).expect(200).then((response) => expect(response.body.data.state).toBe("archived"));
    const stillThere = await (await getDb()).collection("products").findOne({ _id: new ObjectId(created.id) });
    expect(stillThere?.state).toBe("archived");
    await mutateAs(owner, "delete", `/api/v1/admin/products/${created.id}`).expect(200).then((response) => expect(response.body.data.alreadyArchived).toBe(true));
  }, 60_000);
});

describe("API-08 promotions CRUD", () => {
  const code = `WAVE15${run.toUpperCase()}`;

  it("creates, lists, patches and archives a promotion behind promos:manage", async () => {
    const startsAt = "2026-01-01T00:00:00.000Z";
    const endsAt = "2030-01-01T00:00:00.000Z";
    const created = await mutateAs(owner, "post", "/api/v1/admin/promotions")
      .send({ code, name: "Wave 15 probe", percentOff: 10, maxDiscountMinor: 5000, startsAt, endsAt })
      .expect(201);
    promotionCodes.push(code);
    // Shape pinned to what activePromotion() consumes.
    expect(created.body.data).toMatchObject({ code, percentOff: 10, maxDiscountMinor: 5000, state: "active", kind: "percentage" });
    expect(created.body.data.startsAt).toBeDefined();
    expect(created.body.data.endsAt).toBeDefined();
    // Duplicate code → 409 from the unique index, not 500.
    await mutateAs(owner, "post", "/api/v1/admin/promotions")
      .send({ code, percentOff: 5, startsAt, endsAt })
      .expect(409)
      .then((response) => expect(response.body.code).toBe("PROMO_CODE_CONFLICT"));
    const patched = await mutateAs(owner, "patch", `/api/v1/admin/promotions/${created.body.data.id}`).send({ percentOff: 15 }).expect(200);
    expect(patched.body.data.percentOff).toBe(15);
    expect(patched.body.data.maxDiscountMinor).toBe(5000); // preserved through the merge
    await mutateAs(owner, "delete", `/api/v1/admin/promotions/${created.body.data.id}`).expect(200).then((response) => expect(response.body.data.state).toBe("archived"));
    const listed = await readAs(owner, "/api/v1/admin/promotions?state=active").expect(200);
    expect(listed.body.data.map((promotion: { code: string }) => promotion.code)).not.toContain(code);
  }, 60_000);

  it("validates bounds and denies customers", async () => {
    const dates = { startsAt: "2026-01-01T00:00:00.000Z", endsAt: "2030-01-01T00:00:00.000Z" };
    await mutateAs(owner, "post", "/api/v1/admin/promotions").send({ code: `BAD${run}`, percentOff: 0, ...dates }).expect(422);
    await mutateAs(owner, "post", "/api/v1/admin/promotions").send({ code: `BAD${run}`, percentOff: 10, startsAt: dates.endsAt, endsAt: dates.startsAt }).expect(422);
    await mutateAs(customer, "post", "/api/v1/admin/promotions").send({ code: `NOPE${run}`, percentOff: 10, ...dates }).expect(403).then((response) => expect(response.body.meta.missingPermission).toBe("promos:manage"));
  }, 60_000);
});

describe("API-09 categories CRUD", () => {
  const slug = `wave15-cat-${run}`;

  it("creates a category and refuses to delete it while products reference it", async () => {
    const created = await mutateAs(owner, "post", "/api/v1/admin/categories")
      .send({ slug, name: "Wave15 Probes", blurb: "A temporary category used by the integration suite.", icon: "c-power.svg" })
      .expect(201);
    categorySlugs.push(slug);
    expect(created.body.data.imageUrl).toBe("/catalog/c-power.svg");
    expect(created.body.data.icon).toBe("c-power.svg");
    await mutateAs(owner, "post", "/api/v1/admin/categories")
      .send({ slug, name: "Duplicate", blurb: "Slug uniqueness surfaces as a conflict.", icon: "c-power.svg" })
      .expect(409)
      .then((response) => expect(response.body.code).toBe("SLUG_CONFLICT"));
    // Attach one product, then the delete guard must refuse with the count.
    const product = await createScratchProduct(owner, { categorySlug: slug });
    await mutateAs(owner, "delete", `/api/v1/admin/categories/${created.body.data.id}`)
      .expect(409)
      .then((response) => {
        expect(response.body.code).toBe("CATEGORY_IN_USE");
        expect(response.body.meta.productCount).toBe(1);
      });
    // Detach (remove the scratch product directly), then deletion succeeds.
    await (await getDb()).collection("products").deleteOne({ _id: new ObjectId(product.id) });
    productIds.splice(productIds.indexOf(new ObjectId(product.id)), 1);
    await mutateAs(owner, "delete", `/api/v1/admin/categories/${created.body.data.id}`).expect(204);
    await mutateAs(customer, "post", "/api/v1/admin/categories").send({ slug: `nope-${run}`, name: "Denied", blurb: "Customers cannot write categories.", icon: "c-power.svg" }).expect(403).then((response) => expect(response.body.meta.missingPermission).toBe("catalog:write"));
  }, 60_000);
});

describe("API-10 order detail and invoice", () => {
  const reference = `BZ-W15-${run.toUpperCase()}`;
  const snapshotLines = [{ variantId: new ObjectId().toString(), productId: new ObjectId().toString(), slug: "nova-power-bank-20k", name: "Nova Power Bank 20K", imageUrl: "/catalog/nova-power-bank-20k/01-800.webp", quantity: 2, unitPrice: { amountMinor: 4999, currency: "USD" }, lineTotal: { amountMinor: 9998, currency: "USD" } }];
  const totals = { subtotal: { amountMinor: 9998, currency: "USD" }, discount: { amountMinor: 0, currency: "USD" }, shipping: { amountMinor: 799, currency: "USD" }, tax: { amountMinor: 800, currency: "USD" }, total: { amountMinor: 11597, currency: "USD" } };

  beforeAll(async () => {
    const db = await getDb();
    const now = new Date();
    await db.collection("orders").insertOne({
      ownerKey: `user:${customer.uid}`,
      reference,
      state: "delivered",
      payment: { method: "simulator", status: "confirmed", label: "Demo payment — no charge" },
      shipping: { fullName: "Test Buyer", email: `${customer.uid}@example.test`, address1: "1 Probe Way", city: "Beirut", state: "Beirut", postalCode: "1234", country: "Lebanon" },
      shippingMethod: "standard",
      lines: snapshotLines,
      totals,
      promotionCode: null,
      timeline: [{ state: "confirmed", at: now }, { state: "delivered", at: now }],
      createdAt: now,
      updatedAt: now,
    });
    orderReferences.push(reference);
  });

  it("returns the full order with timeline and linked returns to orders:read holders", async () => {
    const response = await readAs(owner, `/api/v1/admin/orders/${reference}`).expect(200);
    expect(response.body.data.reference).toBe(reference);
    expect(response.body.data.lines).toEqual(snapshotLines);
    expect(response.body.data.timeline).toHaveLength(2);
    expect(response.body.data.returns).toEqual([]);
    // Customers hold no orders:read — the admin detail endpoint denies them.
    await readAs(customer, `/api/v1/admin/orders/${reference}`).expect(403).then((responseBody) => expect(responseBody.body.meta.missingPermission).toBe("orders:read"));
  }, 30_000);

  it("serves the invoice to the owner and admins, and 404s strangers without leaking existence", async () => {
    const ownerView = await readAs(customer, `/api/v1/admin/orders/${reference}/invoice`).expect(200);
    expect(ownerView.body.data.lines[0]).toMatchObject({ name: "Nova Power Bank 20K", quantity: 2 });
    expect(ownerView.body.data.total.amountMinor).toBe(11597); // straight from the stored snapshot
    expect(ownerView.body.data.payment.simulated).toBe(true);
    expect(ownerView.body.data.payment.disclosure).toContain("No card was charged");
    await readAs(owner, `/api/v1/admin/orders/${reference}/invoice`).expect(200);
    // A different customer gets the same 404 as a missing order — never a 403.
    await readAs(stranger, `/api/v1/admin/orders/${reference}/invoice`).expect(404).then((response) => expect(response.body.code).toBe("ORDER_NOT_FOUND"));
    await readAs(stranger, "/api/v1/admin/orders/BZ-W15-does-not-exist/invoice").expect(404);
  }, 30_000);
});

describe("API-11 analytics", () => {
  it("returns bounded revenue buckets, by-state counts, top products and low stock", async () => {
    const response = await readAs(owner, `/api/v1/admin/analytics?bucket=daily&from=2026-01-01T00:00:00.000Z&to=2026-03-01T00:00:00.000Z`).expect(200);
    expect(response.body.data.revenueDefinition.statesExcluded).toEqual(expect.arrayContaining(["awaiting_payment", "payment_failed", "cancelled", "refunded"]));
    for (const row of response.body.data.revenue) {
      expect(Number.isInteger(row.amountMinor)).toBe(true);
      expect(row.amountMinor).toBeGreaterThanOrEqual(0);
    }
    expect(Array.isArray(response.body.data.ordersByState)).toBe(true);
    expect(Array.isArray(response.body.data.topProducts.byRevenue)).toBe(true);
    expect(Array.isArray(response.body.data.topProducts.byUnits)).toBe(true);
    for (const row of response.body.data.lowStock) {
      expect(row.sellable).toBeLessThanOrEqual(5);
      expect(["out_of_stock", "low_stock"]).toContain(row.availability);
    }
  }, 30_000);

  it("caps the range, validates the bucket and denies customers", async () => {
    await readAs(owner, `/api/v1/admin/analytics?from=2024-01-01T00:00:00.000Z&to=2026-01-01T00:00:00.000Z`).expect(422).then((response) => expect(response.body.code).toBe("RANGE_TOO_LONG"));
    await readAs(owner, "/api/v1/admin/analytics?bucket=hourly").expect(422);
    await readAs(customer, "/api/v1/admin/analytics").expect(403).then((response) => expect(response.body.meta.missingPermission).toBe("analytics:read"));
  }, 30_000);
});

describe("API-05 stock alerts", () => {
  it("registers idempotently per (product, ownerKey), refuses in-stock items, and resolves audit-only on restock", async () => {
    // Guests cannot register: with an allowed origin the request passes the origin/CSRF gates
    // and is stopped by the router-wide requireUser with 401 AUTH_REQUIRED.
    await request(app).post("/api/v1/admin/products/x/stock-alert").set("origin", config.webOrigin).send({}).expect(401).then((response) => expect(response.body.code).toBe("AUTH_REQUIRED"));
    const created = await createScratchProduct(owner, {
      options: [{ name: "Colour", values: ["Black", "White"] }],
      variants: [
        { optionValues: ["Black"], onHand: 0 },
        { optionValues: ["White"], onHand: 5 },
      ],
    });
    const detail = await readAs(owner, `/api/v1/admin/products/${created.id}`).expect(200);
    const blackVariant = detail.body.data.variants.find((variant: { options: Record<string, string> }) => variant.options.Colour === "Black");
    const whiteVariant = detail.body.data.variants.find((variant: { options: Record<string, string> }) => variant.options.Colour === "White");
    // In-stock variants refuse registration up front.
    await mutateAs(owner, "post", `/api/v1/admin/products/${created.slug}/stock-alert`).send({ variantId: whiteVariant.id }).expect(409).then((response) => expect(response.body.code).toBe("ITEM_IN_STOCK"));
    const variantId = blackVariant.id;
    // The customer registers on the out-of-stock variant; the payload says delivery is out of scope.
    const first = await mutateAs(customer, "post", `/api/v1/admin/products/${created.slug}/stock-alert`)
      .send({ variantId, email: "Watcher@Example.test" })
      .expect(201);
    expect(first.body.meta.delivery).toBe("none");
    expect(first.body.meta.note).toContain("out of scope");
    // Duplicate registration is idempotent — same alert, replayed flag, still one row.
    const second = await mutateAs(customer, "post", `/api/v1/admin/products/${created.slug}/stock-alert`).send({ variantId }).expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.meta.replayed).toBe(true);
    const db = await getDb();
    expect(await db.collection("stockAlerts").countDocuments({ productId: new ObjectId(created.id) })).toBe(1);
    // Restock resolves the alert and writes exactly ONE audit entry naming the count.
    await mutateAs(owner, "post", `/api/v1/admin/inventory/${variantId}/adjust`).set("idempotency-key", `wave15-${run}-restock`).send({ delta: 5, reason: "wave 1.5 restock probe" }).expect(200);
    const alert = await db.collection("stockAlerts").findOne({ productId: new ObjectId(created.id) });
    expect(alert?.state).toBe("resolved");
    const audits = await db.collection("auditLogs").find({ action: "stockAlert.resolved", entityId: variantId }).toArray();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.changes).toMatchObject({ resolvedCount: 1, trigger: "restock" });
    // The audit trail must not contain the watcher's email address.
    const registerAudits = await db.collection("auditLogs").find({ action: "stockAlert.register", entityId: created.id }).toArray();
    expect(JSON.stringify(registerAudits)).not.toContain("watcher@example.test");
  }, 90_000);
});
