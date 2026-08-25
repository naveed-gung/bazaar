import request from "supertest";
import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { createApp } from "../src/app.js";
import { getDb } from "../src/database/client.js";
import { config } from "../src/config.js";

const app = createApp();

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

type UserFixture = {
  uid: string;
  email: string;
  session: { token: string; csrf: string };
};

/** Direct session seeding per tests/app.test.ts + welcome-discount.test.ts. */
async function setupUser(): Promise<UserFixture> {
  const db = await getDb();
  const uid = `profile-test-${randomBytes(8).toString("hex")}`;
  const email = `${uid}@example.test`;
  const token = randomBytes(48).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await db.collection("users").insertOne({ firebaseUid: uid, email, displayName: "Profile Tester", roles: ["customer"], createdAt: new Date() });
  await db.collection("sessions").insertOne({
    tokenHash: sha256(token),
    csrfHash: sha256(csrf),
    familyId: randomBytes(12).toString("hex"),
    firebaseUid: uid,
    email,
    displayName: "Profile Tester",
    expiresAt: new Date(Date.now() + 60_000),
    purgeAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  return { uid, email, session: { token, csrf } };
}

async function teardown(fixture: UserFixture) {
  const db = await getDb();
  await Promise.all([
    db.collection("sessions").deleteMany({ firebaseUid: fixture.uid }),
    db.collection("users").deleteOne({ firebaseUid: fixture.uid }),
  ]);
}

function getProfile(session: { token: string }) {
  return request(app)
    .get("/api/v1/me/profile")
    .set("Cookie", `bazaar_session=${session.token}`);
}

function putProfile(session: { token: string; csrf: string }, body: Record<string, unknown>) {
  return request(app)
    .put("/api/v1/me/profile")
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${session.token}`, `bazaar_csrf=${session.csrf}`])
    .set("x-csrf-token", session.csrf)
    .send(body);
}

function putAvatar(session: { token: string; csrf: string }, imageBase64: string) {
  return request(app)
    .put("/api/v1/me/avatar")
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${session.token}`, `bazaar_csrf=${session.csrf}`])
    .set("x-csrf-token", session.csrf)
    .send({ imageBase64 });
}

function deleteAvatar(session: { token: string; csrf: string }) {
  return request(app)
    .delete("/api/v1/me/avatar")
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${session.token}`, `bazaar_csrf=${session.csrf}`])
    .set("x-csrf-token", session.csrf)
    .send();
}

/** Smallest valid 1×1 PNG — well under the 250 KB cap. */
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("account profile (SSR-21)", () => {
  it("requires an authenticated user for every profile surface", async () => {
    const guest = await request(app).get("/api/v1/me/profile");
    expect(guest.status).toBe(401);
    expect(guest.body.code).toBe("AUTH_REQUIRED");

    const guestAvatar = await request(app)
      .put("/api/v1/me/avatar")
      .set("origin", config.webOrigin)
      .send({ imageBase64: `data:image/png;base64,${TINY_PNG}` });
    expect(guestAvatar.status).toBe(401);
    expect(guestAvatar.body.code).toBe("AUTH_REQUIRED");
  }, 15_000);

  it("persists phone and marketing consent server-side and returns them on read", async () => {
    const fixture = await setupUser();
    try {
      const saved = await putProfile(fixture.session, { phone: "+961 3 123 456", marketingConsent: true }).expect(200);
      expect(saved.body.data.phone).toBe("+961 3 123 456");
      expect(saved.body.data.marketingConsent).toBe(true);
      expect(saved.body.data.email).toBe(fixture.email);

      const read = await getProfile(fixture.session).expect(200);
      expect(read.body.data.phone).toBe("+961 3 123 456");
      expect(read.body.data.marketingConsent).toBe(true);

      // The owner directive is real persistence on the users document, not client-side state.
      const stored = await (await getDb()).collection("users").findOne({ firebaseUid: fixture.uid });
      expect(stored?.["profile"]?.["phone"]).toBe("+961 3 123 456");
      expect(stored?.["profile"]?.["marketingConsent"]).toBe(true);
      expect(stored?.["profile"]?.["updatedAt"]).toBeInstanceOf(Date);
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("rejects malformed phone numbers and non-boolean consent with problem details", async () => {
    const fixture = await setupUser();
    try {
      const badPhone = await putProfile(fixture.session, { phone: "call me maybe" }).expect(422);
      expect(badPhone.body.code).toBe("VALIDATION_FAILED");
      const badConsent = await putProfile(fixture.session, { marketingConsent: "yes" }).expect(422);
      expect(badConsent.body.code).toBe("VALIDATION_FAILED");
      const unknown = await putProfile(fixture.session, { injected: true }).expect(422);
      expect(unknown.body.code).toBe("UNKNOWN_FIELDS");
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("stores an avatar as base64 and serves it back as a data URL", async () => {
    const fixture = await setupUser();
    try {
      const uploaded = await putAvatar(fixture.session, `data:image/png;base64,${TINY_PNG}`).expect(200);
      expect(uploaded.body.data.photoDataUrl).toBe(`data:image/png;base64,${TINY_PNG}`);

      const read = await getProfile(fixture.session).expect(200);
      expect(read.body.data.photoDataUrl).toBe(`data:image/png;base64,${TINY_PNG}`);

      const stored = await (await getDb()).collection("users").findOne({ firebaseUid: fixture.uid });
      expect(stored?.["profile"]?.["photoBase64"]).toBe(TINY_PNG);
      expect(stored?.["profile"]?.["photoMime"]).toBe("image/png");
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("rejects disallowed mime types and payloads over the 250 KB cap", async () => {
    const fixture = await setupUser();
    try {
      const wrongMime = await putAvatar(fixture.session, `data:image/gif;base64,${TINY_PNG}`).expect(422);
      expect(wrongMime.body.code).toBe("VALIDATION_FAILED");
      const notAnImage = await putAvatar(fixture.session, "definitely-not-a-data-url").expect(422);
      expect(notAnImage.body.code).toBe("VALIDATION_FAILED");

      const oversized = Buffer.alloc(250 * 1024 + 1, 7).toString("base64");
      const tooBig = await putAvatar(fixture.session, `data:image/jpeg;base64,${oversized}`).expect(422);
      expect(tooBig.body.code).toBe("VALIDATION_FAILED");

      // Exactly at the cap is allowed.
      const atCap = Buffer.alloc(250 * 1024, 7).toString("base64");
      await putAvatar(fixture.session, `data:image/webp;base64,${atCap}`).expect(200);
    } finally {
      await teardown(fixture);
    }
  }, 30_000);

  it("clears the avatar without touching the rest of the profile", async () => {
    const fixture = await setupUser();
    try {
      await putProfile(fixture.session, { phone: "+1 555 010 1234", marketingConsent: false }).expect(200);
      await putAvatar(fixture.session, `data:image/png;base64,${TINY_PNG}`).expect(200);
      await deleteAvatar(fixture.session).expect(204);

      const read = await getProfile(fixture.session).expect(200);
      expect(read.body.data.photoDataUrl).toBeNull();
      expect(read.body.data.phone).toBe("+1 555 010 1234");
      expect(read.body.data.marketingConsent).toBe(false);

      const stored = await (await getDb()).collection("users").findOne({ firebaseUid: fixture.uid });
      expect(stored?.["profile"]?.["photoBase64"]).toBeUndefined();
      expect(stored?.["profile"]?.["photoMime"]).toBeUndefined();
    } finally {
      await teardown(fixture);
    }
  }, 30_000);
});
