/**
 * Role-based access control domain logic: seeding the system roles, resolving a principal's
 * effective permission set from their role keys, and the legacy role-value rename
 * ("admin" → "owner", "client" → "customer") that keeps existing accounts authorised across
 * the RBAC cutover.
 *
 * Roles are data (documents in the `roles` collection); permissions are code, named literally
 * by every guarded route. See packages/shared/src/permissions.ts for the contract both sides
 * import so they cannot drift.
 */
import type { Db } from "mongodb";
import { isPermission, SYSTEM_ROLES, type Permission } from "@bazaar/shared";

/** Legacy pre-RBAC role values still present in old user documents and session copies. */
const LEGACY_ROLE_ALIASES: Readonly<Record<string, string>> = { admin: "owner", client: "customer" };

/** Maps deprecated role keys onto their system successors and deduplicates. */
export function normalizeRoleKeys(roleKeys: readonly string[]): string[] {
  return [...new Set(roleKeys.map((key) => LEGACY_ROLE_ALIASES[key] ?? key))];
}

/**
 * Union of the permissions held by the named roles, deduplicated; unknown keys are ignored.
 * Costs exactly one database round trip: a single `find({ key: { $in: keys } })`. Never
 * memoised across requests — a role edit must take effect on the caller's next request.
 */
export async function resolvePermissions(db: Db, roleKeys: readonly string[]): Promise<Permission[]> {
  const keys = normalizeRoleKeys(roleKeys);
  if (!keys.length) return [];
  const roles = await db
    .collection("roles")
    .find({ key: { $in: keys } })
    .project<{ permissions?: unknown }>({ permissions: 1 })
    .toArray();
  const resolved = new Set<Permission>();
  for (const role of roles) {
    if (!Array.isArray(role.permissions)) continue;
    for (const permission of role.permissions) {
      if (isPermission(permission)) resolved.add(permission);
    }
  }
  return [...resolved];
}

/**
 * Upserts the four system roles from the shared contract on `key`, forcing `system: true`.
 * Idempotent — runs on every seed. System roles can be re-permissioned at runtime (except
 * revoking `users:manage` from `owner`, blocked by the lockout guard in routes/rbac.ts),
 * and reseeding restores the shipped matrix.
 */
export async function seedSystemRoles(db: Db): Promise<number> {
  const now = new Date();
  for (const role of SYSTEM_ROLES) {
    await db.collection("roles").updateOne(
      { key: role.key },
      {
        $set: {
          name: role.name,
          description: role.description,
          permissions: [...role.permissions],
          system: true,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  return SYSTEM_ROLES.length;
}

/**
 * One-off backfill renaming legacy role values on user documents (`"admin"` → `"owner"`,
 * `"client"` → `"customer"`) so live accounts do not lose access at the cutover. Idempotent:
 * after the first run no document matches. Complements the aliasing in `normalizeRoleKeys`,
 * which covers any straggler document the backfill has not reached yet.
 */
export async function backfillLegacyUserRoles(db: Db): Promise<{ adminsRenamed: number; clientsRenamed: number }> {
  const admins = await db.collection("users").updateMany(
    { roles: "admin" },
    { $set: { "roles.$[legacy]": "owner" } },
    { arrayFilters: [{ legacy: "admin" }] },
  );
  const clients = await db.collection("users").updateMany(
    { roles: "client" },
    { $set: { "roles.$[legacy]": "customer" } },
    { arrayFilters: [{ legacy: "client" }] },
  );
  return { adminsRenamed: admins.modifiedCount, clientsRenamed: clients.modifiedCount };
}
