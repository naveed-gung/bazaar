import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";

const app = createApp();

describe("API shell", () => {
  it("returns health metadata and a request id", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);
    expect(response.headers["x-request-id"]).toBeTruthy();
    expect(response.body.data.status).toBe("ok");
  });

  it("uses problem details for missing routes", async () => {
    const response = await request(app).get("/api/v1/does-not-exist").expect(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("rejects unsafe requests without the configured origin", async () => {
    const response = await request(app).post("/api/v1/contact").send({}).expect(403);
    expect(response.body.code).toBe("ORIGIN_REJECTED");
  });

  it("issues an HttpOnly guest identity and keeps the cart stable for that browser", async () => {
    const browser = request.agent(app);
    const first = await browser.get("/api/v1/cart").expect(200);
    const setCookie = String(first.headers["set-cookie"]);
    expect(setCookie).toContain("bazaar_guest=");
    expect(setCookie).toContain("HttpOnly");
    const second = await browser.get("/api/v1/cart").expect(200);
    expect(second.body.data.id).toBe(first.body.data.id);
  }, 15_000);

  it("ignores client-asserted guest identity headers", async () => {
    const attackerChosenId = "guest_shared-client-value";
    const first = await request(app).get("/api/v1/cart").set("x-guest-id", attackerChosenId).expect(200);
    const second = await request(app).get("/api/v1/cart").set("x-guest-id", attackerChosenId).expect(200);
    expect(second.body.data.id).not.toBe(first.body.data.id);
  }, 15_000);

  it("sets an explicit content security policy", async () => {
    const response = await request(app).get("/api/v1/health").expect(200);
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["content-security-policy"]).toContain("object-src 'none'");
  });

  it("does not let stale session roles restore revoked administrator access", async () => {
    const db = await getDb();
    const uid = `security-test-${randomBytes(8).toString("hex")}`;
    const token = randomBytes(48).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    try {
      await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Security Test", roles: ["client"], createdAt: new Date() });
      await db.collection("sessions").insertOne({ tokenHash, firebaseUid: uid, email: `${uid}@example.test`, displayName: "Security Test", roles: ["admin"], expiresAt: new Date(Date.now() + 60_000), purgeAt: new Date(Date.now() + 60_000), createdAt: new Date() });
      const response = await request(app).get("/api/v1/admin/dashboard").set("cookie", `bazaar_session=${token}`).expect(403);
      expect(response.body.code).toBe("ADMIN_REQUIRED");
      const user = await db.collection("users").findOne({ firebaseUid: uid });
      expect(user?.["roles"]).toEqual(["client"]);
    } finally {
      await Promise.all([db.collection("sessions").deleteMany({ firebaseUid: uid }), db.collection("users").deleteOne({ firebaseUid: uid })]);
    }
  }, 15_000);

  it("applies a concurrent admin inventory idempotency key only once", async () => {
    const db = await getDb();
    const uid = `inventory-test-${randomBytes(8).toString("hex")}`;
    const token = randomBytes(48).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    const variantId = new ObjectId();
    const idempotencyKey = `adjust-${randomBytes(12).toString("hex")}`;
    const sessionSelector = { firebaseUid: uid };
    try {
      await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Inventory Test", roles: ["admin"], createdAt: new Date() });
      await db.collection("sessions").insertOne({ tokenHash: createHash("sha256").update(token).digest("hex"), csrfHash: createHash("sha256").update(csrf).digest("hex"), familyId: randomBytes(12).toString("hex"), firebaseUid: uid, email: `${uid}@example.test`, displayName: "Inventory Test", expiresAt: new Date(Date.now() + 60_000), purgeAt: new Date(Date.now() + 60_000), createdAt: new Date() });
      await db.collection("inventory").insertOne({ variantId, onHand: 0, reserved: 0, version: 1, updatedAt: new Date() });
      const mutate = () => request(app)
        .post(`/api/v1/admin/inventory/${variantId.toString()}/adjust`)
        .set("origin", config.webOrigin)
        .set("Cookie", [`bazaar_session=${token}`, `bazaar_csrf=${csrf}`])
        .set("x-csrf-token", csrf)
        .set("idempotency-key", idempotencyKey)
        .send({ delta: 10, reason: "concurrency regression" });
      const responses = await Promise.all([mutate(), mutate()]);
      expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);
      expect(await db.collection("inventoryLedger").countDocuments({ idempotencyKey })).toBe(1);
      expect((await db.collection("inventory").findOne({ variantId }))?.["onHand"]).toBe(10);
    } finally {
      await Promise.all([
        db.collection("inventoryLedger").deleteMany({ idempotencyKey }),
        db.collection("inventory").deleteOne({ variantId }),
        db.collection("sessions").deleteMany(sessionSelector),
        db.collection("users").deleteOne({ firebaseUid: uid }),
      ]);
    }
  }, 30_000);

  it("rejects unknown and unbounded after-sales input before order lookup", async () => {
    const response = await request(app)
      .post("/api/v1/orders/UNKNOWN/returns")
      .set("origin", config.webOrigin)
      .send({ reason: "valid reason", resolution: "refund", injected: true })
      .expect(422);
    expect(response.body.code).toBe("UNKNOWN_FIELDS");
  }, 15_000);

  it("restores unfulfilled stock when an admin approves a processing cancellation", async () => {
    const db = await getDb();
    const uid = `cancel-test-${randomBytes(8).toString("hex")}`;
    const token = randomBytes(48).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    const variantId = new ObjectId();
    const orderId = new ObjectId();
    const reference = `BZ-TEST-${randomBytes(4).toString("hex").toUpperCase()}`;
    try {
      await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Cancellation Test", roles: ["admin"], createdAt: new Date() });
      await db.collection("sessions").insertOne({ tokenHash: createHash("sha256").update(token).digest("hex"), csrfHash: createHash("sha256").update(csrf).digest("hex"), familyId: randomBytes(12).toString("hex"), firebaseUid: uid, email: `${uid}@example.test`, displayName: "Cancellation Test", expiresAt: new Date(Date.now() + 60_000), purgeAt: new Date(Date.now() + 60_000), createdAt: new Date() });
      await db.collection("inventory").insertOne({ variantId, onHand: 10, reserved: 0, version: 1, updatedAt: new Date() });
      await db.collection("orders").insertOne({ _id: orderId, ownerKey: "guest:test", idempotencyKey: randomBytes(12).toString("hex"), reference, state: "cancellation_requested", lines: [{ variantId: variantId.toString(), quantity: 2 }], totals: { total: { amountMinor: 1_000, currency: "USD" } }, timeline: [], createdAt: new Date(), updatedAt: new Date() });
      await request(app)
        .patch(`/api/v1/admin/orders/${reference}/state`)
        .set("origin", config.webOrigin)
        .set("Cookie", [`bazaar_session=${token}`, `bazaar_csrf=${csrf}`])
        .set("x-csrf-token", csrf)
        .send({ fromState: "cancellation_requested", state: "cancelled" })
        .expect(200);
      expect((await db.collection("inventory").findOne({ variantId }))?.["onHand"]).toBe(12);
      expect(await db.collection("inventoryLedger").countDocuments({ reference, reason: "approved_cancellation" })).toBe(1);
      expect((await db.collection("orders").findOne({ _id: orderId }))?.["state"]).toBe("cancelled");
    } finally {
      await Promise.all([
        db.collection("auditLogs").deleteMany({ entityId: orderId.toString() }),
        db.collection("inventoryLedger").deleteMany({ reference }),
        db.collection("inventory").deleteOne({ variantId }),
        db.collection("orders").deleteOne({ _id: orderId }),
        db.collection("sessions").deleteMany({ firebaseUid: uid }),
        db.collection("users").deleteOne({ firebaseUid: uid }),
      ]);
    }
  }, 30_000);
});
