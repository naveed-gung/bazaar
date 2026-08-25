import type { NextFunction, Request, Response } from "express";
import { createHash } from "node:crypto";
import type { Permission } from "@bazaar/shared";
import { getDb } from "../database/client.js";
import { resolvePermissions } from "../domain/rbac.js";
import { AppError } from "../errors.js";

export async function authenticateOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const session = req.cookies?.["bazaar_session"] as string | undefined;
  if (!session) { next(); return; }
  try {
    const db = await getDb();
    const sessionHash = createHash("sha256").update(session).digest("hex");
    const activeSession = await db.collection("sessions").findOne({ tokenHash: sessionHash, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
    if (!activeSession) throw new Error("Session is not active");
    const user = await db.collection("users").findOneAndUpdate(
      { firebaseUid: activeSession["firebaseUid"] },
      { $set: { email: activeSession["email"], displayName: activeSession["displayName"], lastSeenAt: new Date() }, $setOnInsert: { roles: ["customer"], createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    // Roles come from the user document fetched THIS request — never from the role copy
    // stored on the session document — so a role edit or revocation takes effect on the
    // caller's very next request. Resolution costs one extra query over `roles`.
    const storedRoles = Array.isArray(user?.["roles"]) ? user.roles as string[] : ["customer"];
    const permissions = await resolvePermissions(db, storedRoles);
    req.principal = {
      type: "user",
      id: String(activeSession["firebaseUid"]),
      email: typeof activeSession["email"] === "string" ? activeSession["email"] : null,
      displayName: typeof activeSession["displayName"] === "string" ? activeSession["displayName"] : null,
      roles: storedRoles,
      permissions,
    };
    req.sessionHash = sessionHash;
    if (typeof activeSession["familyId"] === "string") req.sessionFamilyId = activeSession["familyId"];
    if (typeof activeSession["csrfHash"] === "string") req.csrfHash = activeSession["csrfHash"];
    await db.collection("sessions").updateOne({ tokenHash: sessionHash }, { $set: { lastSeenAt: new Date() } });
    next();
  } catch {
    if (req.path === "/api/v1/auth/refresh") { next(); return; }
    next(new AppError(401, "SESSION_INVALID", "Your session expired. Sign in again."));
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (req.principal.type !== "user") { next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue.")); return; }
  next();
}

/**
 * Per-endpoint authorisation. Implies authentication: a guest gets 401 AUTH_REQUIRED, a
 * signed-in user lacking any listed permission gets 403 PERMISSION_DENIED with the missing
 * permission named in the detail (and mirrored in `meta.missingPermission`).
 */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.principal.type !== "user") { next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue.")); return; }
    const missing = required.find((permission) => !req.principal.permissions.includes(permission));
    if (missing !== undefined) {
      next(new AppError(403, "PERMISSION_DENIED", `The ${missing} permission is required for this action.`, undefined, { missingPermission: missing }));
      return;
    }
    next();
  };
}
