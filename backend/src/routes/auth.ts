import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { firebaseAuth } from "../auth/firebase.js";
import { config } from "../config.js";
import { AppError } from "../errors.js";
import { asyncHandler } from "../lib/http.js";
import { requireUser } from "../middleware/auth.js";
import { getDb, getMongoClient } from "../database/client.js";
import { issueGuestIdentity } from "../middleware/request-context.js";

export const authRouter = Router();
const accessLifetime = 15 * 60 * 1000;
const refreshIdleLifetime = 7 * 24 * 60 * 60 * 1000;
const refreshAbsoluteLifetime = 30 * 24 * 60 * 60 * 1000;
const guestLinkLifetime = 5 * 24 * 60 * 60 * 1000;

authRouter.get("/status", (req, res) => {
  // Never cacheable: permissions are resolved per request and role changes must be visible immediately.
  res.setHeader("cache-control", "no-store");
  res.json({
    data: {
      authenticated: req.principal.type === "user",
      refreshable: Boolean(req.cookies?.["bazaar_refresh"]),
      principal: req.principal.type === "user"
        ? {
            id: req.principal.id,
            email: req.principal.email,
            displayName: req.principal.displayName,
            roles: req.principal.roles,
            permissions: req.principal.permissions,
          }
        : null,
      firebaseConfigured: Boolean(firebaseAuth()),
    },
  });
});

authRouter.post("/session", asyncHandler(async (req, res) => {
  if (Object.keys(req.body ?? {}).some((key) => key !== "idToken")) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown session fields are not allowed.");
  const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
  const auth = firebaseAuth();
  if (!auth) throw new AppError(503, "AUTH_NOT_CONFIGURED", "Firebase browser and server configuration is required.");
  if (!idToken || idToken.length > 10_000) throw new AppError(422, "ID_TOKEN_REQUIRED", "A valid Firebase ID token is required.");
  const decoded = await auth.verifyIdToken(idToken, true);
  if (Date.now() / 1000 - decoded.auth_time > 5 * 60) throw new AppError(401, "RECENT_LOGIN_REQUIRED", "Sign in again before creating a session.");
  const sessionCookie = randomBytes(48).toString("base64url");
  const refreshCookie = randomBytes(48).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  const familyId = randomBytes(24).toString("base64url");
  const bootstrapRoles = decoded["role"] === "admin" || decoded.email?.toLowerCase() === config.bootstrapAdminEmail.toLowerCase() ? ["owner"] : ["customer"];
  const db = await getDb();
  const user = await db.collection("users").findOneAndUpdate(
    { firebaseUid: decoded.uid },
    { $set: { email: decoded.email?.toLowerCase(), displayName: decoded.name, lastSeenAt: new Date() }, $setOnInsert: { roles: bootstrapRoles, createdAt: new Date() } },
    { upsert: true, returnDocument: "after" },
  );
  const roles = Array.isArray(user?.["roles"]) ? user.roles as string[] : ["customer"];
  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + refreshAbsoluteLifetime);
  await db.collection("sessions").insertOne({ tokenHash: hash(sessionCookie), refreshTokenHash: hash(refreshCookie), csrfHash: hash(csrf), familyId, firebaseUid: decoded.uid, email: decoded.email?.toLowerCase(), displayName: decoded.name, roles, userAgent: req.header("user-agent")?.slice(0, 300), ipHash: hash(req.ip ?? "unknown"), createdAt: now, lastSeenAt: now, expiresAt: new Date(now.getTime() + accessLifetime), refreshExpiresAt: new Date(now.getTime() + refreshIdleLifetime), absoluteExpiresAt, purgeAt: absoluteExpiresAt });
  const mergeReport = await mergeGuestState(db, req.guestSessionHash, `user:${decoded.uid}`);
  setSessionCookies(res, sessionCookie, refreshCookie, csrf);
  res.status(201).json({ data: { authenticated: true, uid: decoded.uid, csrfToken: csrf, mergeReport } });
}));

authRouter.post("/refresh", asyncHandler(async (req, res) => {
  const suppliedRefresh = req.cookies?.["bazaar_refresh"] as string | undefined;
  const csrfCookie = req.cookies?.["bazaar_csrf"] as string | undefined;
  const csrfHeader = req.header("x-csrf-token");
  if (!suppliedRefresh || !csrfCookie || !csrfHeader || !sameSecret(csrfCookie, csrfHeader)) throw new AppError(401, "REFRESH_INVALID", "Sign in again to continue.");
  const db = await getDb();
  const stored = await db.collection("sessions").findOne({ refreshTokenHash: hash(suppliedRefresh) });
  if (!stored) throw new AppError(401, "REFRESH_INVALID", "Sign in again to continue.");
  if (stored["rotatedAt"]) {
    await db.collection("sessions").updateMany({ familyId: stored["familyId"] }, { $set: { revokedAt: new Date(), revocationReason: "refresh_replay" } });
    clearSessionCookies(res);
    throw new AppError(401, "REFRESH_REPLAY_DETECTED", "This session was revoked. Sign in again.");
  }
  const now = new Date();
  const csrfValid = typeof stored["csrfHash"] === "string" && sameSecret(hash(csrfCookie), stored["csrfHash"]);
  if (!csrfValid || stored["revokedAt"] || !(stored["refreshExpiresAt"] instanceof Date) || stored["refreshExpiresAt"] <= now || !(stored["absoluteExpiresAt"] instanceof Date) || stored["absoluteExpiresAt"] <= now) {
    clearSessionCookies(res);
    throw new AppError(401, "REFRESH_INVALID", "Sign in again to continue.");
  }
  const nextAccess = randomBytes(48).toString("base64url");
  const nextRefresh = randomBytes(48).toString("base64url");
  const nextCsrf = randomBytes(24).toString("base64url");
  const nextRefreshExpiry = new Date(Math.min(now.getTime() + refreshIdleLifetime, stored["absoluteExpiresAt"].getTime()));
  const mongoSession = (await getMongoClient()).startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const claimed = await db.collection("sessions").updateOne(
        { _id: stored._id, rotatedAt: { $exists: false }, revokedAt: { $exists: false } },
        { $set: { rotatedAt: now, replacedByTokenHash: hash(nextAccess) } },
        { session: mongoSession },
      );
      if (!claimed.modifiedCount) throw new AppError(401, "REFRESH_REPLAY_DETECTED", "This session was revoked. Sign in again.");
      await db.collection("sessions").insertOne({
        tokenHash: hash(nextAccess), refreshTokenHash: hash(nextRefresh), csrfHash: hash(nextCsrf), familyId: stored["familyId"],
        firebaseUid: stored["firebaseUid"], email: stored["email"], displayName: stored["displayName"], roles: stored["roles"],
        userAgent: req.header("user-agent")?.slice(0, 300), ipHash: hash(req.ip ?? "unknown"), createdAt: now, lastSeenAt: now,
        expiresAt: new Date(now.getTime() + accessLifetime), refreshExpiresAt: nextRefreshExpiry, absoluteExpiresAt: stored["absoluteExpiresAt"], purgeAt: stored["absoluteExpiresAt"],
      }, { session: mongoSession });
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "REFRESH_REPLAY_DETECTED") {
      await db.collection("sessions").updateMany({ familyId: stored["familyId"] }, { $set: { revokedAt: new Date(), revocationReason: "refresh_replay" } });
      clearSessionCookies(res);
    }
    throw error;
  } finally {
    await mongoSession.endSession();
  }
  setSessionCookies(res, nextAccess, nextRefresh, nextCsrf, Math.max(0, nextRefreshExpiry.getTime() - now.getTime()));
  res.json({ data: { authenticated: true, expiresAt: new Date(now.getTime() + accessLifetime) } });
}));

export async function mergeGuestState(db: Awaited<ReturnType<typeof getDb>>, guestSessionHash: string, userOwner: string) {
  const guestOwner = `guest:${guestSessionHash}`;
  const targetUserId = userOwner.slice("user:".length);
  const mongoSession = (await getMongoClient()).startSession();
  let report = { cartLines: 0, favorites: 0, comparisonItems: 0, recentlyViewed: 0, adjustments: [] as string[] };
  try {
    await mongoSession.withTransaction(async () => {
      const existing = await db.collection("guestMerges").findOne({ guestSessionHash, targetUserId }, { session: mongoSession });
      if (existing) {
        report = existing["report"] as typeof report;
        return;
      }
      const guestSession = await db.collection("guestSessions").findOne({ tokenHash: guestSessionHash }, { session: mongoSession });
      if (guestSession?.["state"] === "linked" && guestSession["linkedUserId"] !== targetUserId) {
        throw new AppError(409, "GUEST_ALREADY_LINKED", "This guest session has already been linked.");
      }
      if (guestSession?.["state"] === "linked") return;
      const [guestCart, userCart, guestFavorites, guestComparison, userComparison] = await Promise.all([
        db.collection("carts").findOne({ ownerKey: guestOwner }, { session: mongoSession }),
        db.collection("carts").findOne({ ownerKey: userOwner }, { session: mongoSession }),
        db.collection("favorites").find({ ownerKey: guestOwner }, { session: mongoSession }).toArray(),
        db.collection("comparisons").findOne({ ownerKey: guestOwner }, { session: mongoSession }),
        db.collection("comparisons").findOne({ ownerKey: userOwner }, { session: mongoSession }),
      ]);
      if (guestCart) {
        const quantities = new Map<string, { variantId: unknown; quantity: number }>();
        for (const line of [...(userCart?.["lines"] ?? []), ...(guestCart["lines"] ?? [])] as { variantId: { toString: () => string }; quantity: number }[]) {
          const key = line.variantId.toString();
          const requested = (quantities.get(key)?.quantity ?? 0) + line.quantity;
          if (requested > 10) report.adjustments.push(`Quantity for ${key} was capped at 10.`);
          quantities.set(key, { variantId: line.variantId, quantity: Math.min(10, requested) });
        }
        const lines = [...quantities.values()];
        await db.collection("carts").updateOne(
          { ownerKey: userOwner },
          { $set: { lines, updatedAt: new Date() }, $setOnInsert: { ownerKey: userOwner, revision: 1, createdAt: new Date() }, ...(userCart ? { $inc: { revision: 1 } } : {}) },
          { upsert: true, session: mongoSession },
        );
        report.cartLines = lines.length;
        await db.collection("carts").deleteOne({ ownerKey: guestOwner }, { session: mongoSession });
      }
      for (const favorite of guestFavorites) {
        await db.collection("favorites").updateOne(
          { ownerKey: userOwner, productId: favorite["productId"] },
          { $setOnInsert: { ownerKey: userOwner, productId: favorite["productId"], createdAt: favorite["createdAt"] ?? new Date() } },
          { upsert: true, session: mongoSession },
        );
      }
      report.favorites = guestFavorites.length;
      await db.collection("favorites").deleteMany({ ownerKey: guestOwner }, { session: mongoSession });
      if (guestComparison) {
        const productIds = [...(userComparison?.["productIds"] ?? []), ...(guestComparison["productIds"] ?? [])].filter((id, index, all) => all.findIndex((candidate) => candidate.toString() === id.toString()) === index).slice(0, 4);
        if ((userComparison?.["productIds"]?.length ?? 0) + (guestComparison["productIds"]?.length ?? 0) > 4) report.adjustments.push("Comparison was limited to four products.");
        await db.collection("comparisons").updateOne({ ownerKey: userOwner }, { $set: { productIds, updatedAt: new Date() }, $setOnInsert: { ownerKey: userOwner, createdAt: new Date() } }, { upsert: true, session: mongoSession });
        report.comparisonItems = productIds.length;
        await db.collection("comparisons").deleteOne({ ownerKey: guestOwner }, { session: mongoSession });
      }
      // API-04: recently-viewed history rides the same ownerKey merge — upsert per product so
      // a product present on both sides is never duplicated; the later viewedAt wins.
      const guestViewed = await db.collection("recentlyViewed").find({ ownerKey: guestOwner }, { session: mongoSession }).toArray();
      for (const view of guestViewed) {
        await db.collection("recentlyViewed").updateOne(
          { ownerKey: userOwner, productId: view["productId"] },
          {
            $set: { viewedAt: view["viewedAt"] instanceof Date ? view["viewedAt"] : new Date() },
            $setOnInsert: { ownerKey: userOwner, productId: view["productId"], createdAt: view["createdAt"] instanceof Date ? view["createdAt"] : new Date() },
          },
          { upsert: true, session: mongoSession },
        );
      }
      report.recentlyViewed = guestViewed.length;
      await db.collection("recentlyViewed").deleteMany({ ownerKey: guestOwner }, { session: mongoSession });
      const now = new Date();
      const receipt = await db.collection("guestMerges").insertOne({ guestSessionHash, targetUserId, report, createdAt: now }, { session: mongoSession });
      await db.collection("guestSessions").updateOne(
        { tokenHash: guestSessionHash, state: { $ne: "linked" } },
        { $set: { state: "linked", linkedUserId: targetUserId, linkedAt: now, mergeReceiptId: receipt.insertedId, expiresAt: new Date(now.getTime() + guestLinkLifetime) }, $setOnInsert: { tokenHash: guestSessionHash, createdAt: now } },
        { upsert: true, session: mongoSession },
      );
    });
  } finally {
    await mongoSession.endSession();
  }
  return report;
}

authRouter.post("/logout", requireUser, asyncHandler(async (req, res) => {
  if (req.sessionHash) { const db = await getDb(); await db.collection("sessions").updateMany(req.sessionFamilyId ? { familyId: req.sessionFamilyId } : { tokenHash: req.sessionHash }, { $set: { revokedAt: new Date(), revocationReason: "logout" } }); }
  clearSessionCookies(res);
  res.clearCookie("bazaar_guest", { path: "/" });
  issueGuestIdentity(res);
  res.status(204).end();
}));

function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function sameSecret(left: string, right: string) { return left.length === right.length && timingSafeEqual(Buffer.from(left), Buffer.from(right)); }
function setSessionCookies(res: Parameters<typeof issueGuestIdentity>[0], access: string, refresh: string, csrf: string, refreshMaxAge = refreshIdleLifetime) {
  res.cookie("bazaar_session", access, { httpOnly: true, secure: config.isProduction, sameSite: "lax", maxAge: accessLifetime, path: "/" });
  res.cookie("bazaar_refresh", refresh, { httpOnly: true, secure: config.isProduction, sameSite: "lax", maxAge: refreshMaxAge, path: "/api/v1/auth" });
  res.cookie("bazaar_csrf", csrf, { httpOnly: false, secure: config.isProduction, sameSite: "lax", maxAge: refreshMaxAge, path: "/" });
}
function clearSessionCookies(res: Parameters<typeof issueGuestIdentity>[0]) {
  res.clearCookie("bazaar_session", { path: "/" });
  res.clearCookie("bazaar_refresh", { path: "/api/v1/auth" });
  res.clearCookie("bazaar_csrf", { path: "/" });
}
