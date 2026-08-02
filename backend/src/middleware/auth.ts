import type { NextFunction, Request, Response } from "express";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { createHash } from "node:crypto";

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
      { $set: { email: activeSession["email"], displayName: activeSession["displayName"], lastSeenAt: new Date() }, $setOnInsert: { roles: ["client"], createdAt: new Date() } },
      { upsert: true, returnDocument: "after" },
    );
    const storedRoles = Array.isArray(user?.["roles"]) ? user.roles as string[] : ["client"];
    req.principal = { type: "user", id: String(activeSession["firebaseUid"]), permissions: storedRoles.includes("admin") ? ["admin"] : [] };
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

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.principal.permissions.includes("admin")) { next(new AppError(403, "ADMIN_REQUIRED", "Administrator permission is required.")); return; }
  next();
}
