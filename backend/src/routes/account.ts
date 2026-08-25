import { ObjectId, type Db } from "mongodb";
import { Router } from "express";
import { firebaseAuth } from "../auth/firebase.js";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { asyncHandler } from "../lib/http.js";
import { requireUser } from "../middleware/auth.js";

export const accountRouter = Router();
accountRouter.use(requireUser);

accountRouter.get("/", asyncHandler(async (req, res) => {
  const db = await getDb();
  const user = await db.collection("users").findOne({ firebaseUid: req.principal.id }, { projection: { firebaseUid: 1, email: 1, displayName: 1, phone: 1, createdAt: 1 } });
  res.json({ data: user ? { id: user._id.toString(), email: user.email, displayName: user.displayName, phone: user.phone, createdAt: user.createdAt } : null });
}));

accountRouter.patch("/", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["displayName", "phone"]);
  const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  if (displayName.length < 2 || displayName.length > 100) throw new AppError(422, "VALIDATION_FAILED", "Display name must be between 2 and 100 characters.");
  if (phone.length > 30 || (phone && (phone.length < 7 || !/^[+()\d .-]+$/.test(phone)))) throw new AppError(422, "VALIDATION_FAILED", "Enter a valid phone number.");
  const db = await getDb();
  await db.collection("users").updateOne({ firebaseUid: req.principal.id }, { $set: { displayName, phone, updatedAt: new Date() } });
  res.json({ data: { displayName, phone } });
}));

accountRouter.get("/addresses", asyncHandler(async (req, res) => {
  const db = await getDb(); const addresses = await db.collection("addresses").find({ userId: req.principal.id }).sort({ updatedAt: -1 }).toArray();
  res.json({ data: addresses.map((item) => ({ id: item._id.toString(), label: item.label, fullName: item.fullName, address1: item.address1, address2: item.address2, city: item.city, state: item.state, postalCode: item.postalCode, country: item.country })) });
}));

accountRouter.post("/addresses", asyncHandler(async (req, res) => {
  const fields = addressFields(req.body); const db = await getDb();
  if (await db.collection("addresses").countDocuments({ userId: req.principal.id }, { limit: 20 }) >= 20) throw new AppError(409, "ADDRESS_LIMIT", "You can save up to 20 addresses. Remove one before adding another.");
  const result = await db.collection("addresses").insertOne({ userId: req.principal.id, ...fields, createdAt: new Date(), updatedAt: new Date() });
  res.status(201).json({ data: { id: result.insertedId.toString(), ...fields } });
}));

accountRouter.delete("/addresses/:id", asyncHandler(async (req, res) => {
  const id = String(req.params["id"] ?? ""); if (!ObjectId.isValid(id)) throw new AppError(422, "VALIDATION_FAILED", "Invalid address.");
  const db = await getDb(); await db.collection("addresses").deleteOne({ _id: new ObjectId(id), userId: req.principal.id }); res.status(204).end();
}));

accountRouter.get("/sessions", asyncHandler(async (req, res) => {
  const db = await getDb(); const sessions = await db.collection("sessions").find({ firebaseUid: req.principal.id, revokedAt: { $exists: false }, rotatedAt: { $exists: false }, refreshExpiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).toArray();
  res.json({ data: sessions.map((item) => ({ id: item._id.toString(), current: item.familyId === req.sessionFamilyId, userAgent: item.userAgent, createdAt: item.createdAt, lastSeenAt: item.lastSeenAt, expiresAt: item.refreshExpiresAt })) });
}));

accountRouter.delete("/sessions/:id", asyncHandler(async (req, res) => {
  const id = String(req.params["id"] ?? ""); if (!ObjectId.isValid(id)) throw new AppError(422, "VALIDATION_FAILED", "Invalid session.");
  const db = await getDb(); const session = await db.collection("sessions").findOne({ _id: new ObjectId(id), firebaseUid: req.principal.id });
  if (session?.["familyId"] === req.sessionFamilyId) throw new AppError(409, "CURRENT_SESSION", "Use sign out to revoke the current session.");
  if (session?.["familyId"]) await db.collection("sessions").updateMany({ firebaseUid: req.principal.id, familyId: session["familyId"] }, { $set: { revokedAt: new Date(), revocationReason: "device_revoked" } });
  res.status(204).end();
}));

accountRouter.delete("/sessions", asyncHandler(async (req, res) => {
  const db = await getDb();
  const result = await db.collection("sessions").updateMany({ firebaseUid: req.principal.id, familyId: { $ne: req.sessionFamilyId }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date(), revocationReason: "other_devices_revoked" } });
  res.json({ data: { revoked: result.modifiedCount } });
}));

// ---------------------------------------------------------------- profile (SSR-21)

/**
 * Account profile persistence. Everything lives on the EXISTING users document under a
 * lazily-upserted `profile` sub-document — no new collection, no manifest change:
 *
 *   profile: { phone?: string, photoBase64?: string, photoMime?: string,
 *              marketingConsent?: boolean, updatedAt: Date }
 *
 * Avatars are stored as base64 strings (owner directive) and served back as data URLs;
 * the CSP already allows `img-src data:`. Uploads accept only PNG/JPEG/WebP data URLs
 * whose decoded payload is at most 250 KB.
 */

/** Loose E.164-ish shape: optional leading +, then 7–20 digits with common separators. */
const PHONE_PATTERN = /^\+?[0-9][0-9 ()\-.]{5,19}$/;

/** Avatars arrive as full data URLs; only these raster formats are accepted. */
const AVATAR_PATTERN = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
/** Owner-set cap on the DECODED avatar size. */
const AVATAR_MAX_BYTES = 250 * 1024;

type ProfileFields = {
  phone?: string;
  photoBase64?: string;
  photoMime?: string;
  marketingConsent?: boolean;
};

function profileOf(user: Record<string, unknown> | null): ProfileFields {
  const raw = user?.["profile"];
  if (typeof raw !== "object" || raw === null) return {};
  const profile = raw as Record<string, unknown>;
  return {
    ...(typeof profile["phone"] === "string" ? { phone: profile["phone"] } : {}),
    ...(typeof profile["photoBase64"] === "string" ? { photoBase64: profile["photoBase64"] } : {}),
    ...(typeof profile["photoMime"] === "string" ? { photoMime: profile["photoMime"] } : {}),
    ...(profile["marketingConsent"] === true ? { marketingConsent: true } : {}),
  };
}

function photoDataUrlOf(profile: ProfileFields): string | null {
  return profile.photoBase64 && profile.photoMime
    ? `data:${profile.photoMime};base64,${profile.photoBase64}`
    : null;
}

/** Shared read behind GET /me/profile and every mutating response below. */
async function loadProfile(db: Db, uid: string) {
  const user = await db.collection("users").findOne({ firebaseUid: uid }, { projection: { phone: 1, profile: 1 } });
  const profile = profileOf(user ?? null);
  // PATCH / (legacy account form) still writes a top-level phone; keep it visible until
  // the profile field is set so neither writer's data can silently disappear.
  const legacyPhone = typeof user?.["phone"] === "string" ? user["phone"] : "";
  let emailVerified: boolean | undefined;
  const adminAuth = firebaseAuth();
  if (adminAuth) {
    try {
      emailVerified = (await adminAuth.getUser(uid)).emailVerified;
    } catch {
      /* No Firebase record reachable for this uid — omit the field rather than fail the read. */
    }
  }
  return {
    phone: profile.phone || legacyPhone || null,
    marketingConsent: profile.marketingConsent === true,
    photoDataUrl: photoDataUrlOf(profile),
    ...(emailVerified === undefined ? {} : { emailVerified }),
  };
}

accountRouter.get("/profile", asyncHandler(async (req, res) => {
  const db = await getDb();
  res.json({
    data: {
      email: req.principal.email,
      displayName: req.principal.displayName,
      ...(await loadProfile(db, req.principal.id)),
    },
  });
}));

accountRouter.put("/profile", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["phone", "marketingConsent"]);
  const body = req.body as Record<string, unknown> | undefined;
  const update: Record<string, unknown> = {};
  if (body?.["phone"] !== undefined) {
    const phone = typeof body["phone"] === "string" ? body["phone"].trim() : "";
    if (phone && !PHONE_PATTERN.test(phone)) throw new AppError(422, "VALIDATION_FAILED", "Enter a valid phone number, e.g. +1 555 010 1234.");
    update["profile.phone"] = phone; // empty string clears the stored value
  }
  if (body?.["marketingConsent"] !== undefined) {
    if (typeof body["marketingConsent"] !== "boolean") throw new AppError(422, "VALIDATION_FAILED", "marketingConsent must be true or false.");
    update["profile.marketingConsent"] = body["marketingConsent"];
  }
  if (Object.keys(update).length === 0) throw new AppError(422, "VALIDATION_FAILED", "Provide a phone or marketingConsent value to save.");
  const db = await getDb();
  await db.collection("users").updateOne(
    { firebaseUid: req.principal.id },
    { $set: { ...update, "profile.updatedAt": new Date() } },
    { upsert: true },
  );
  res.json({
    data: {
      email: req.principal.email,
      displayName: req.principal.displayName,
      ...(await loadProfile(db, req.principal.id)),
    },
  });
}));

accountRouter.put("/avatar", asyncHandler(async (req, res) => {
  rejectUnknown(req.body, ["imageBase64"]);
  const raw = typeof req.body?.["imageBase64"] === "string" ? req.body["imageBase64"] : "";
  const match = AVATAR_PATTERN.exec(raw.replace(/\s/g, ""));
  const subtype = match?.[1];
  const base64 = match?.[2];
  if (!subtype || !base64) throw new AppError(422, "VALIDATION_FAILED", "Avatars must be PNG, JPEG or WebP images.");
  const mime = `image/${subtype}`;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const decodedBytes = Math.floor((base64.length * 3) / 4) - padding;
  if (decodedBytes > AVATAR_MAX_BYTES) throw new AppError(422, "VALIDATION_FAILED", "Avatars must be 250 KB or smaller.");
  const db = await getDb();
  await db.collection("users").updateOne(
    { firebaseUid: req.principal.id },
    { $set: { "profile.photoBase64": base64, "profile.photoMime": mime, "profile.updatedAt": new Date() } },
    { upsert: true },
  );
  res.json({ data: { photoDataUrl: `data:${mime};base64,${base64}` } });
}));

accountRouter.delete("/avatar", asyncHandler(async (req, res) => {
  const db = await getDb();
  await db.collection("users").updateOne(
    { firebaseUid: req.principal.id },
    { $unset: { "profile.photoBase64": "", "profile.photoMime": "" }, $set: { "profile.updatedAt": new Date() } },
    { upsert: true },
  );
  res.status(204).end();
}));

function addressFields(body: Record<string, unknown> | undefined) {
  rejectUnknown(body, ["label", "fullName", "address1", "address2", "city", "state", "postalCode", "country"]);
  const required = ["label", "fullName", "address1", "city", "state", "postalCode", "country"] as const;
  const values = Object.fromEntries(required.map((key) => [key, typeof body?.[key] === "string" ? body[key].trim() : ""])) as Record<(typeof required)[number], string>;
  const address2 = typeof body?.["address2"] === "string" ? body.address2.trim() : "";
  if (required.some((key) => !values[key]) || Object.values(values).some((value) => value.length > 160) || address2.length > 160) throw new AppError(422, "VALIDATION_FAILED", "Complete address details of 160 characters or fewer are required.");
  return { ...values, address2 };
}

function rejectUnknown(body: Record<string, unknown> | undefined, allowed: string[]) {
  if (Object.keys(body ?? {}).some((key) => !allowed.includes(key))) throw new AppError(422, "UNKNOWN_FIELDS", "Unknown account fields are not allowed.");
}
