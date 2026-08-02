import { ObjectId } from "mongodb";
import { Router } from "express";
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
