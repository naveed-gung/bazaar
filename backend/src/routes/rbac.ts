/**
 * Role & user-role management API. Every endpoint requires `users:manage`.
 *
 * Lockout guards (all 409 LOCKOUT_PREVENTED):
 *  - the `owner` system role can never lose `users:manage`;
 *  - a role edit may not leave zero roles holding `users:manage`;
 *  - a caller cannot strip their own last source of `users:manage`.
 * System roles cannot be deleted (409 ROLE_IS_SYSTEM) and neither can a role still
 * assigned to any user (409 ROLE_IN_USE, with the count in meta). Every mutation writes
 * an `auditLogs` entry carrying actor, action, target and the before/after arrays.
 *
 * Rate limiting and CSRF come from the app-level middleware bound to `/api/v1/admin`
 * (see app.ts) because this router is mounted on the same prefix.
 */
import type { Document, Filter } from "mongodb";
import { Router } from "express";
import { isPermission, type Permission } from "@bazaar/shared";
import { getDb } from "../database/client.js";
import { resolvePermissions } from "../domain/rbac.js";
import { AppError } from "../errors.js";
import { asyncHandler, parsePositiveInteger } from "../lib/http.js";
import { requirePermission } from "../middleware/auth.js";

export const rbacRouter = Router();

const USERS_PAGE_SIZE = 20;
/** Legacy pre-RBAC values stay reserved so old data can never collide with a new custom role. */
const RESERVED_KEYS = new Set(["admin", "client"]);
const KEY_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;

function permissionList(value: unknown): Permission[] {
  if (!Array.isArray(value)) throw new AppError(422, "VALIDATION_FAILED", "permissions must be an array of permission strings.");
  const unique = new Set<Permission>();
  for (const entry of value) {
    if (!isPermission(entry)) throw new AppError(422, "VALIDATION_FAILED", `"${String(entry)}" is not a known permission.`);
    unique.add(entry);
  }
  return [...unique];
}

function boundedText(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") throw new AppError(422, "VALIDATION_FAILED", `${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new AppError(422, "VALIDATION_FAILED", `${field} must be between ${min} and ${max} characters.`);
  return trimmed;
}

function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) {
  if (Object.keys(body ?? {}).some((key) => !allowed.includes(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown fields are not allowed.");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function audit(db: Awaited<ReturnType<typeof getDb>>, actorId: string, action: string, entityType: string, entityId: string, changes: unknown): Promise<void> {
  await db.collection("auditLogs").insertOne({ actorId, action, entityType, entityId, changes, createdAt: new Date() });
}

// ---------------------------------------------------------------- roles

rbacRouter.get("/roles", requirePermission("users:manage"), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const [roles, counts] = await Promise.all([
    db.collection("roles").find().sort({ key: 1 }).toArray(),
    db.collection("users").aggregate<{ _id: string; count: number }>([{ $unwind: "$roles" }, { $group: { _id: "$roles", count: { $sum: 1 } } }]).toArray(),
  ]);
  const userCountByKey = new Map(counts.map((row) => [row._id, row.count]));
  res.json({
    data: roles.map((role) => ({
      key: role["key"],
      name: role["name"],
      description: role["description"],
      permissions: Array.isArray(role["permissions"]) ? (role["permissions"] as unknown[]).filter(isPermission) : [],
      system: role["system"] === true,
      userCount: userCountByKey.get(String(role["key"])) ?? 0,
    })),
  });
}));

rbacRouter.post("/roles", requirePermission("users:manage"), asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["key", "name", "description", "permissions"]);
  const key = boundedText(req.body?.["key"], "key", 2, 63).toLowerCase();
  if (!KEY_PATTERN.test(key) || RESERVED_KEYS.has(key)) throw new AppError(422, "VALIDATION_FAILED", "Role key must be 2-63 lowercase letters, digits or hyphens and cannot use a reserved legacy key.");
  const role = {
    key,
    name: boundedText(req.body?.["name"], "name", 2, 80),
    description: boundedText(req.body?.["description"], "description", 2, 300),
    permissions: permissionList(req.body?.["permissions"]),
    system: false,
  };
  const db = await getDb();
  const existing = await db.collection("roles").findOne({ key: role.key });
  if (existing) throw new AppError(409, "ROLE_EXISTS", "A role with that key already exists.");
  const now = new Date();
  await db.collection("roles").insertOne({ ...role, createdAt: now, updatedAt: now });
  await audit(db, req.principal.id, "role.create", "role", role.key, { before: null, after: { name: role.name, permissions: role.permissions, system: false } });
  res.status(201).json({ data: { ...role, userCount: 0 } });
}));

rbacRouter.patch("/roles/:key", requirePermission("users:manage"), asyncHandler(async (req, res) => {
  const key = String(req.params["key"] ?? "");
  rejectUnknown(req.body, ["name", "description", "permissions"]);
  const db = await getDb();
  const role = await db.collection("roles").findOne({ key });
  if (!role) throw new AppError(404, "ROLE_NOT_FOUND", "Role not found.");
  const before = Array.isArray(role["permissions"]) ? (role["permissions"] as unknown[]).filter(isPermission) : [];

  const update: Record<string, unknown> = {};
  if (req.body?.["name"] !== undefined) update["name"] = boundedText(req.body["name"], "name", 2, 80);
  if (req.body?.["description"] !== undefined) update["description"] = boundedText(req.body["description"], "description", 2, 300);
  let after = before;
  if (req.body?.["permissions"] !== undefined) {
    after = permissionList(req.body["permissions"]);
    update["permissions"] = after;
  }

  if (!after.includes("users:manage") && before.includes("users:manage")) {
    if (key === "owner") throw new AppError(409, "LOCKOUT_PREVENTED", "The owner role must keep the users:manage permission.");
    const remaining = await db.collection("roles").countDocuments({ key: { $ne: key }, permissions: "users:manage" });
    if (remaining === 0) throw new AppError(409, "LOCKOUT_PREVENTED", "At least one role must keep the users:manage permission.");
  }

  if (!Object.keys(update).length) throw new AppError(422, "VALIDATION_FAILED", "At least one role change is required.");
  const updated = await db.collection("roles").findOneAndUpdate({ key }, { $set: { ...update, updatedAt: new Date() } }, { returnDocument: "after" });
  if (!updated) throw new AppError(409, "ROLE_STATE_CONFLICT", "The role changed. Refresh and retry.");
  const userCount = await db.collection("users").countDocuments({ roles: key });
  await audit(db, req.principal.id, "role.update", "role", key, { before: { permissions: before }, after: { permissions: after } });
  res.json({ data: { key, name: updated["name"], description: updated["description"], permissions: after, system: updated["system"] === true, userCount } });
}));

rbacRouter.delete("/roles/:key", requirePermission("users:manage"), asyncHandler(async (req, res) => {
  const key = String(req.params["key"] ?? "");
  const db = await getDb();
  const role = await db.collection("roles").findOne({ key });
  if (!role) throw new AppError(404, "ROLE_NOT_FOUND", "Role not found.");
  if (role["system"] === true) throw new AppError(409, "ROLE_IS_SYSTEM", "System roles cannot be deleted.");
  const userCount = await db.collection("users").countDocuments({ roles: key });
  if (userCount > 0) throw new AppError(409, "ROLE_IN_USE", `${userCount} user${userCount === 1 ? "" : "s"} still hold this role.`, undefined, { userCount });
  const before = Array.isArray(role["permissions"]) ? (role["permissions"] as unknown[]).filter(isPermission) : [];
  await db.collection("roles").deleteOne({ key });
  await audit(db, req.principal.id, "role.delete", "role", key, { before: { name: role["name"], permissions: before }, after: null });
  res.status(204).end();
}));

// ---------------------------------------------------------------- user-role assignment

rbacRouter.get("/users", requirePermission("users:manage"), asyncHandler(async (req, res) => {
  const page = parsePositiveInteger(req.query["page"], 1, 10_000);
  const filter: Filter<Document> = {};
  const role = typeof req.query["role"] === "string" ? req.query["role"].trim() : "";
  if (role) filter["roles"] = role;
  const q = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (q) filter["$or"] = [{ email: new RegExp(escapeRegex(q), "i") }, { displayName: new RegExp(escapeRegex(q), "i") }];
  const db = await getDb();
  const total = await db.collection("users").countDocuments(filter);
  const users = await db.collection("users")
    .find(filter, { projection: { firebaseUid: 1, email: 1, displayName: 1, roles: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * USERS_PAGE_SIZE)
    .limit(USERS_PAGE_SIZE)
    .toArray();
  res.json({
    data: {
      items: users.map((user) => ({
        id: String(user["firebaseUid"] ?? user["_id"].toString()),
        email: typeof user["email"] === "string" ? user["email"] : null,
        displayName: typeof user["displayName"] === "string" ? user["displayName"] : null,
        roles: Array.isArray(user["roles"]) ? user["roles"] as string[] : [],
        createdAt: user["createdAt"],
      })),
      page,
      pageSize: USERS_PAGE_SIZE,
      total,
      pages: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    },
  });
}));

rbacRouter.put("/users/:uid/roles", requirePermission("users:manage"), asyncHandler(async (req, res) => {
  const uid = String(req.params["uid"] ?? "");
  rejectUnknown(req.body, ["roles"]);
  const rawRoles = req.body?.["roles"];
  if (!Array.isArray(rawRoles) || rawRoles.some((entry) => typeof entry !== "string")) throw new AppError(422, "VALIDATION_FAILED", "roles must be an array of role keys.");
  const desired = [...new Set((rawRoles as string[]).map((entry) => entry.trim()).filter(Boolean))];
  const db = await getDb();
  const known = desired.length ? await db.collection("roles").find({ key: { $in: desired } }).project<{ key: unknown }>({ key: 1 }).toArray() : [];
  if (known.length !== desired.length) throw new AppError(422, "VALIDATION_FAILED", "Every role key must reference an existing role.");
  const target = await db.collection("users").findOne({ firebaseUid: uid });
  if (!target) throw new AppError(404, "USER_NOT_FOUND", "User not found.");

  // Self-demotion guard: a caller holding users:manage cannot remove their own last source
  // of it — that would lock them out of the very screen they are using.
  if (uid === req.principal.id && req.principal.permissions.includes("users:manage")) {
    const nextPermissions = await resolvePermissions(db, desired);
    if (!nextPermissions.includes("users:manage")) throw new AppError(409, "LOCKOUT_PREVENTED", "You cannot remove your own access to user management.");
  }

  const before = Array.isArray(target["roles"]) ? target["roles"] as string[] : [];
  const updated = await db.collection("users").findOneAndUpdate(
    { firebaseUid: uid },
    { $set: { roles: desired, updatedAt: new Date() } },
    { returnDocument: "after", projection: { email: 1, displayName: 1, roles: 1 } },
  );
  if (!updated) throw new AppError(409, "USER_STATE_CONFLICT", "The user changed. Refresh and retry.");
  await audit(db, req.principal.id, "user.roles.update", "user", uid, { before: { roles: before }, after: { roles: desired } });
  res.json({
    data: {
      id: uid,
      email: typeof updated["email"] === "string" ? updated["email"] : null,
      displayName: typeof updated["displayName"] === "string" ? updated["displayName"] : null,
      roles: desired,
    },
  });
}));
