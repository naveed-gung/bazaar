import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getStore } from "@netlify/blobs";
import { AppError } from "../errors.js";
import { asyncHandler } from "../lib/http.js";
import { requirePermission } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";

export const mediaRouter = Router();
const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

mediaRouter.get("/:key", asyncHandler(async (req, res) => {
  const key = String(req.params["key"] ?? "");
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key)) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
  const store = getStore("product-media");
  const metadata = await store.getMetadata(key);
  if (!metadata) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
  const data = await store.get(key, { type: "arrayBuffer" });
  res.setHeader("content-type", String(metadata.metadata["contentType"] ?? "application/octet-stream"));
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(data));
}));

mediaRouter.post("/", requirePermission("catalog:write"), rateLimit({ name: "media-upload", limit: 20, windowMs: 60 * 60_000, principal: true }), asyncHandler(async (req, res) => {
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
  const dataBase64 = typeof req.body?.dataBase64 === "string" ? req.body.dataBase64 : "";
  const extension = allowedTypes.get(contentType);
  if (!extension || !dataBase64) throw new AppError(422, "MEDIA_INVALID", "A JPEG, PNG, WebP, or AVIF image is required.");
  if (dataBase64.length > 1_000_000 || dataBase64.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dataBase64)) throw new AppError(422, "MEDIA_ENCODING_INVALID", "Image data must be canonical base64.");
  const data = Buffer.from(dataBase64, "base64");
  if (data.length === 0 || data.length > 750_000) throw new AppError(413, "MEDIA_TOO_LARGE", "Product media must be 750 KB or smaller.");
  if (!matchesFileSignature(contentType, data)) throw new AppError(422, "MEDIA_SIGNATURE_MISMATCH", "The image contents do not match the declared file type.");
  const key = `${randomUUID()}.${extension}`;
  try {
    await getStore("product-media").set(key, Uint8Array.from(data).buffer, { metadata: { contentType, uploadedBy: req.principal.id } });
  } catch {
    throw new AppError(503, "MEDIA_STORAGE_UNAVAILABLE", "Media storage is not configured in this environment.");
  }
  res.status(201).json({ data: { key, url: `/api/v1/media/${key}`, contentType, size: data.length } });
}));

function matchesFileSignature(contentType: string, data: Buffer) {
  if (contentType === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (contentType === "image/png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (contentType === "image/webp") return data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  if (contentType === "image/avif") return data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp" && ["avif", "avis"].includes(data.subarray(8, 12).toString("ascii"));
  return false;
}

mediaRouter.delete("/:key", requirePermission("catalog:write"), asyncHandler(async (req, res) => {
  const key = String(req.params["key"] ?? "");
  if (!/^[a-f0-9-]+\.(?:jpg|png|webp|avif)$/.test(key)) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
  await getStore("product-media").delete(key);
  res.status(204).end();
}));
