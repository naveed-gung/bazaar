import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";
import { safeMediaUrl } from "../src/routes/admin.js";

const app = createApp();

describe("safeMediaUrl", () => {
  it("still accepts legacy single-segment catalog paths", () => {
    expect(safeMediaUrl("/catalog/p-camera.jpg")).toBe(true);
    expect(safeMediaUrl("/catalog/c-phone.svg")).toBe(true);
  });

  it("accepts per-slug gallery paths with exactly one extra segment", () => {
    expect(safeMediaUrl("/catalog/nova-x1-phone/01-800.webp")).toBe(true);
    expect(safeMediaUrl("/catalog/vector-studio-16/03-1200.webp")).toBe(true);
  });

  it("keeps the Bazaar-managed media branch unchanged", () => {
    expect(safeMediaUrl("/api/v1/media/0f8fad5b-d9cb-469f-a165-70867728950e.webp")).toBe(true);
    expect(safeMediaUrl("/api/v1/media/abc123.jpg")).toBe(true);
    expect(safeMediaUrl("/api/v1/media/abc123.png")).toBe(true);
    expect(safeMediaUrl("/api/v1/media/abc123.avif")).toBe(true);
    expect(safeMediaUrl("/api/v1/media/abc123.gif")).toBe(false);
    expect(safeMediaUrl("/api/v1/media/not-a-uuid.webp")).toBe(false);
  });

  it("rejects traversal, protocol-relative, and over-deep paths", () => {
    expect(safeMediaUrl("/catalog/../secrets")).toBe(false);
    expect(safeMediaUrl("/catalog/a/b/c")).toBe(false);
    expect(safeMediaUrl("//evil.com/x")).toBe(false);
    expect(safeMediaUrl("/catalog/")).toBe(false);
    expect(safeMediaUrl("/catalog/slug/")).toBe(false);
    expect(safeMediaUrl("/catalog/a//b")).toBe(false);
    expect(safeMediaUrl("https://evil.com/x")).toBe(false);
    expect(safeMediaUrl("/catalog")).toBe(false);
    expect(safeMediaUrl("")).toBe(false);
    expect(safeMediaUrl("/catalog/a b.png")).toBe(false);
  });

  it("keeps the 500-character cap", () => {
    const exact = `/catalog/${"a".repeat(500 - "/catalog/".length)}`;
    expect(exact.length).toBe(500);
    expect(safeMediaUrl(exact)).toBe(true);
    const over = `${exact}x`;
    expect(over.length).toBe(501);
    expect(safeMediaUrl(over)).toBe(false);
  });
});

describe("admin product media URL validation", () => {
  it("patches a product to a per-slug gallery path but rejects a third segment", async () => {
    const db = await getDb();
    const uid = `media-test-${randomBytes(8).toString("hex")}`;
    const token = randomBytes(48).toString("base64url");
    const csrf = randomBytes(24).toString("base64url");
    const productId = new ObjectId();
    try {
      await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "Media Test", roles: ["admin"], createdAt: new Date() });
      await db.collection("sessions").insertOne({ tokenHash: createHash("sha256").update(token).digest("hex"), csrfHash: createHash("sha256").update(csrf).digest("hex"), familyId: randomBytes(12).toString("hex"), firebaseUid: uid, email: `${uid}@example.test`, displayName: "Media Test", expiresAt: new Date(Date.now() + 60_000), purgeAt: new Date(Date.now() + 60_000), createdAt: new Date() });
      await db.collection("products").insertOne({ _id: productId, slug: `media-test-${randomBytes(4).toString("hex")}`, name: "Media Test Product", brand: "Test Brand", category: "Test Category", categorySlug: "test-category", priceMinor: 1000, imageUrl: "/catalog/p-camera.jpg", blurb: "A product used to exercise media URL validation.", state: "draft", specs: [], rating: 0, reviewCount: 0, revision: 1, publishedAt: null, createdAt: new Date(), updatedAt: new Date() });
      const patch = (imageUrl: string, revision: number) => request(app)
        .patch(`/api/v1/admin/products/${productId.toString()}`)
        .set("origin", config.webOrigin)
        .set("Cookie", [`bazaar_session=${token}`, `bazaar_csrf=${csrf}`])
        .set("x-csrf-token", csrf)
        .send({ revision, imageUrl });
      const ok = await patch("/catalog/nova-x1-phone/01-800.webp", 1).expect(200);
      expect(ok.body.data.imageUrl).toBe("/catalog/nova-x1-phone/01-800.webp");
      const rejected = await patch("/catalog/a/b/c", 2).expect(422);
      expect(rejected.body.code).toBe("MEDIA_URL_INVALID");
    } finally {
      await Promise.all([
        db.collection("auditLogs").deleteMany({ entityId: productId.toString() }),
        db.collection("products").deleteOne({ _id: productId }),
        db.collection("sessions").deleteMany({ firebaseUid: uid }),
        db.collection("users").deleteOne({ firebaseUid: uid }),
      ]);
    }
  }, 30_000);
});
