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
const createdRoleKeys: string[] = [];

async function createPrincipal(roles: string[]): Promise<TestPrincipal> {
  const db = await getDb();
  const uid = `rbac-test-${randomBytes(8).toString("hex")}`;
  const token = randomBytes(48).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await db.collection("users").insertOne({ firebaseUid: uid, email: `${uid}@example.test`, displayName: "RBAC Test", roles: [...roles], createdAt: new Date() });
  await db.collection("sessions").insertOne({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    csrfHash: createHash("sha256").update(csrf).digest("hex"),
    familyId: randomBytes(12).toString("hex"),
    firebaseUid: uid,
    email: `${uid}@example.test`,
    displayName: "RBAC Test",
    roles: [...roles],
    expiresAt: new Date(Date.now() + 60_000),
    purgeAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  });
  const principal = { uid, token, csrf };
  createdPrincipals.push(principal);
  return principal;
}

/** Signed-in GET (safe method — no CSRF or origin requirements). */
function readAs(principal: TestPrincipal, url: string) {
  return request(app).get(url).set("cookie", `bazaar_session=${principal.token}`);
}

/** Signed-in mutation with the double-submit CSRF pair and configured origin. */
function mutateAs(principal: TestPrincipal, method: MutatingMethod, url: string) {
  return request(app)[method](url)
    .set("origin", config.webOrigin)
    .set("Cookie", [`bazaar_session=${principal.token}`, `bazaar_csrf=${principal.csrf}`])
    .set("x-csrf-token", principal.csrf);
}

async function latestAudit(action: string, entityId: string) {
  const db = await getDb();
  return db.collection("auditLogs").findOne({ action, entityId }, { sort: { createdAt: -1 } });
}

beforeAll(async () => {
  // The permission matrix lives in the `roles` collection; make sure the four system roles
  // exist (idempotent upsert) before any request resolves permissions.
  await seedSystemRoles(await getDb());
});

afterAll(async () => {
  const db = await getDb();
  const uids = createdPrincipals.map((principal) => principal.uid);
  const entityIds = [...createdRoleKeys, ...uids];
  await Promise.all([
    db.collection("sessions").deleteMany({ firebaseUid: { $in: uids } }),
    db.collection("users").deleteMany({ firebaseUid: { $in: uids } }),
    db.collection("roles").deleteMany({ key: { $in: createdRoleKeys }, system: { $ne: true } }),
    db.collection("auditLogs").deleteMany({ $or: [{ actorId: { $in: uids } }, { entityId: { $in: entityIds } }] }),
  ]);
});

describe("rbac permission matrix", () => {
  it("sends guests to 401 AUTH_REQUIRED, not 403, on admin endpoints", async () => {
    const response = await request(app).get("/api/v1/admin/roles").expect(401);
    expect(response.body.code).toBe("AUTH_REQUIRED");
  }, 15_000);

  it("lets owner manage roles and reports resolved roles and permissions on /auth/status", async () => {
    const owner = await createPrincipal(["owner"]);
    const status = await readAs(owner, "/api/v1/auth/status").expect(200);
    expect(status.body.data.principal.roles).toEqual(["owner"]);
    expect(status.body.data.principal.permissions).toContain("users:manage");
    expect(status.headers["cache-control"]).toBe("no-store");
    const roles = await readAs(owner, "/api/v1/admin/roles").expect(200);
    const keys = roles.body.data.map((role: { key: string }) => role.key);
    expect(keys).toEqual(expect.arrayContaining(["owner", "ops", "support", "customer"]));
    const customer = roles.body.data.find((role: { key: string }) => role.key === "customer");
    expect(customer.system).toBe(true);
    expect(customer.permissions).toEqual([]);
    // Owner holds every permission by design, so no endpoint can 403 them; their denial
    // case is the lockout guard covered below.
  }, 30_000);

  it("lets ops run the catalogue but not read the audit log", async () => {
    const ops = await createPrincipal(["ops"]);
    await readAs(ops, "/api/v1/admin/products").expect(200);
    const denied = await readAs(ops, "/api/v1/admin/audits").expect(403);
    expect(denied.body.code).toBe("PERMISSION_DENIED");
    expect(denied.body.meta.missingPermission).toBe("users:manage");
  }, 30_000);

  it("lets support read orders but not edit products", async () => {
    const support = await createPrincipal(["support"]);
    await readAs(support, "/api/v1/admin/orders").expect(200);
    const denied = await mutateAs(support, "patch", `/api/v1/admin/products/${new ObjectId().toString()}`).send({ revision: 1 }).expect(403);
    expect(denied.body.code).toBe("PERMISSION_DENIED");
    expect(denied.body.meta.missingPermission).toBe("catalog:write");
  }, 30_000);

  it("gives customer no admin permissions while /auth/status still works", async () => {
    const customer = await createPrincipal(["customer"]);
    const status = await readAs(customer, "/api/v1/auth/status").expect(200);
    expect(status.body.data.principal.permissions).toEqual([]);
    const denied = await readAs(customer, "/api/v1/admin/dashboard").expect(403);
    expect(denied.body.code).toBe("PERMISSION_DENIED");
  }, 30_000);
});

describe("rbac guards", () => {
  it("refuses to delete a system role with ROLE_IS_SYSTEM", async () => {
    const owner = await createPrincipal(["owner"]);
    const response = await mutateAs(owner, "delete", "/api/v1/admin/roles/customer").expect(409);
    expect(response.body.code).toBe("ROLE_IS_SYSTEM");
  }, 30_000);

  it("prevents revoking users:manage from the owner role with LOCKOUT_PREVENTED", async () => {
    const owner = await createPrincipal(["owner"]);
    const response = await mutateAs(owner, "patch", "/api/v1/admin/roles/owner")
      .send({ permissions: ["catalog:read", "orders:read"] })
      .expect(409);
    expect(response.body.code).toBe("LOCKOUT_PREVENTED");
    const role = await (await getDb()).collection("roles").findOne({ key: "owner" });
    expect(role?.["permissions"]).toContain("users:manage");
  }, 30_000);

  it("prevents a user from stripping their own last users:manage role", async () => {
    const owner = await createPrincipal(["owner"]);
    const response = await mutateAs(owner, "put", `/api/v1/admin/users/${owner.uid}/roles`).send({ roles: ["customer"] }).expect(409);
    expect(response.body.code).toBe("LOCKOUT_PREVENTED");
  }, 30_000);
});

describe("rbac role lifecycle", () => {
  it("propagates a role permission change to the target user on the next request and audits every mutation", async () => {
    const owner = await createPrincipal(["owner"]);
    const analyst = await createPrincipal(["customer"]);
    const key = `rbac-probe-${randomBytes(4).toString("hex")}`;
    createdRoleKeys.push(key);

    // Create a custom role granting analytics:read only.
    const created = await mutateAs(owner, "post", "/api/v1/admin/roles")
      .send({ key, name: "Probe Analyst", description: "Temporary role used by the RBAC test suite.", permissions: ["analytics:read"] })
      .expect(201);
    expect(created.body.data).toMatchObject({ key, system: false, permissions: ["analytics:read"], userCount: 0 });
    const createAudit = await latestAudit("role.create", key);
    expect(createAudit?.["actorId"]).toBe(owner.uid);
    expect(createAudit?.["changes"]).toMatchObject({ before: null });

    // Assign it to a customer; the dashboard becomes reachable.
    const assigned = await mutateAs(owner, "put", `/api/v1/admin/users/${analyst.uid}/roles`).send({ roles: [key] }).expect(200);
    expect(assigned.body.data.roles).toEqual([key]);
    const assignAudit = await latestAudit("user.roles.update", analyst.uid);
    expect(assignAudit?.["actorId"]).toBe(owner.uid);
    expect(assignAudit?.["changes"]).toMatchObject({ before: { roles: ["customer"] }, after: { roles: [key] } });
    await readAs(analyst, "/api/v1/admin/dashboard").expect(200);

    // Re-permission the role to nothing; the very next request is denied — no re-login.
    const patched = await mutateAs(owner, "patch", `/api/v1/admin/roles/${key}`).send({ permissions: [] }).expect(200);
    expect(patched.body.data.permissions).toEqual([]);
    const patchAudit = await latestAudit("role.update", key);
    expect(patchAudit?.["actorId"]).toBe(owner.uid);
    expect(patchAudit?.["changes"]).toMatchObject({ before: { permissions: ["analytics:read"] }, after: { permissions: [] } });
    const denied = await readAs(analyst, "/api/v1/admin/dashboard").expect(403);
    expect(denied.body.code).toBe("PERMISSION_DENIED");

    // A role still assigned cannot be deleted; unassign, then deletion succeeds.
    const inUse = await mutateAs(owner, "delete", `/api/v1/admin/roles/${key}`).expect(409);
    expect(inUse.body.code).toBe("ROLE_IN_USE");
    expect(inUse.body.meta.userCount).toBe(1);
    await mutateAs(owner, "put", `/api/v1/admin/users/${analyst.uid}/roles`).send({ roles: ["customer"] }).expect(200);
    await mutateAs(owner, "delete", `/api/v1/admin/roles/${key}`).expect(204);
    const deleteAudit = await latestAudit("role.delete", key);
    expect(deleteAudit?.["actorId"]).toBe(owner.uid);
    expect(deleteAudit?.["changes"]).toMatchObject({ after: null });
    expect(await (await getDb()).collection("roles").findOne({ key })).toBeNull();
  }, 60_000);

  it("rejects unknown permission strings with 422 instead of storing them", async () => {
    const owner = await createPrincipal(["owner"]);
    const response = await mutateAs(owner, "post", "/api/v1/admin/roles")
      .send({ key: `rbac-probe-${randomBytes(4).toString("hex")}`, name: "Bad Role", description: "Should never be stored.", permissions: ["catalog:write", "not:a:permission"] })
      .expect(422);
    expect(response.body.code).toBe("VALIDATION_FAILED");
  }, 30_000);
});
