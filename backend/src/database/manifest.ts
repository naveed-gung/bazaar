import type { Db, Document, IndexDescription } from "mongodb";

type CollectionManifest = {
  name: string;
  indexes?: IndexDescription[];
};

export const databaseManifest: CollectionManifest[] = [
  { name: "users", indexes: [{ key: { firebaseUid: 1 }, unique: true, sparse: true }, { key: { email: 1 }, unique: true, sparse: true }] },
  { name: "sessions", indexes: [{ key: { tokenHash: 1 }, unique: true }, { key: { refreshTokenHash: 1 }, unique: true, sparse: true }, { key: { familyId: 1, createdAt: -1 }, sparse: true }, { key: { purgeAt: 1 }, expireAfterSeconds: 0 }] },
  { name: "guestSessions", indexes: [{ key: { tokenHash: 1 }, unique: true }, { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, { key: { state: 1, linkedAt: -1 } }] },
  { name: "guestMerges", indexes: [{ key: { guestSessionHash: 1, targetUserId: 1 }, unique: true }, { key: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 30 }] },
  { name: "addresses", indexes: [{ key: { userId: 1, updatedAt: -1 } }] },
  { name: "categories", indexes: [{ key: { slug: 1 }, unique: true }] },
  { name: "products", indexes: [{ key: { slug: 1 }, unique: true }, { key: { state: 1, categorySlug: 1, publishedAt: -1 } }, { key: { state: 1, publishedAt: -1 } }, { key: { name: "text", brand: "text", blurb: "text" } }] },
  { name: "variants", indexes: [{ key: { sku: 1 }, unique: true }, { key: { productId: 1, state: 1 } }] },
  { name: "inventory", indexes: [{ key: { variantId: 1 }, unique: true }] },
  { name: "inventoryLedger", indexes: [{ key: { variantId: 1, createdAt: -1 } }, { key: { idempotencyKey: 1 }, unique: true }] },
  { name: "carts", indexes: [{ key: { ownerKey: 1 }, unique: true }, { key: { updatedAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 45 }] },
  { name: "favorites", indexes: [{ key: { ownerKey: 1, productId: 1 }, unique: true }] },
  { name: "recentlyViewed", indexes: [{ key: { ownerKey: 1, viewedAt: -1 } }, { key: { viewedAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 90 }] },
  { name: "comparisons", indexes: [{ key: { ownerKey: 1 }, unique: true }] },
  { name: "reservations", indexes: [{ key: { state: 1, expiresAt: 1 } }, { key: { groupId: 1, state: 1 } }, { key: { orderId: 1 } }] },
  { name: "checkoutQuotes", indexes: [{ key: { ownerKey: 1, state: 1, expiresAt: 1 } }] },
  { name: "orders", indexes: [{ key: { reference: 1 }, unique: true }, { key: { ownerKey: 1, createdAt: -1 } }, { key: { idempotencyKey: 1, ownerKey: 1 }, unique: true }] },
  { name: "returns", indexes: [{ key: { reference: 1 }, unique: true }, { key: { orderId: 1, createdAt: -1 } }, { key: { activeOrderId: 1 }, unique: true, sparse: true }] },
  { name: "reviews", indexes: [{ key: { productId: 1, state: 1, createdAt: -1 } }, { key: { userId: 1, productId: 1, orderId: 1 }, unique: true }] },
  { name: "reviewVotes", indexes: [{ key: { reviewId: 1, ownerKey: 1 }, unique: true }] },
  { name: "promotions", indexes: [{ key: { code: 1 }, unique: true, sparse: true }, { key: { state: 1, startsAt: 1, endsAt: 1 } }] },
  { name: "shippingMethods", indexes: [{ key: { key: 1 }, unique: true }] },
  // API-05: one alert per (product, ownerKey) makes duplicate registration idempotent via the
  // unique index; the variant+state pair drives restock resolution lookups. The legacy
  // `{ email, variantId }` unique index could not hold two email-less watchers of the same
  // variant and is dropped by migrateStockAlertIndexes below.
  { name: "stockAlerts", indexes: [{ key: { productId: 1, ownerKey: 1 }, unique: true }, { key: { variantId: 1, state: 1 } }] },
  { name: "notifications", indexes: [{ key: { userId: 1, createdAt: -1 } }] },
  // API-12 DECISION — `outbox` REMOVED from the manifest. It was declared for notification
  // delivery, which the owner placed explicitly out of scope (API-05 resolves stock alerts
  // into auditLogs only; there is no mailer and none is planned). Nothing in backend/ or
  // netlify/ has ever read or written this collection, so its indexes were dead weight that
  // misled readers into thinking a delivery feature exists. The collection itself is NOT
  // dropped (dropping data is a HUMAN-GATE); only index maintenance stops.
  { name: "newsletterSubscriptions", indexes: [{ key: { email: 1 }, unique: true }] },
  { name: "contactMessages", indexes: [{ key: { createdAt: -1 } }] },
  { name: "searchRequests", indexes: [{ key: { normalizedQuery: 1, createdAt: -1 } }, { key: { createdAt: 1 }, expireAfterSeconds: 60 * 60 * 24 * 180 }] },
  { name: "auditLogs", indexes: [{ key: { actorId: 1, createdAt: -1 } }, { key: { entityType: 1, entityId: 1, createdAt: -1 } }] },
  // API-12 DECISION — `idempotency` REMOVED from the manifest. Idempotency is already
  // implemented where it belongs, enforced by unique indexes on the collections that need
  // it: orders carry a unique { idempotencyKey, ownerKey } index with request fingerprints,
  // and inventoryLedger carries a unique idempotencyKey index (also used by the Netlify
  // reservation-expiry function). A generic fourth collection duplicated those mechanisms,
  // had no reader or writer anywhere in the codebase, and is retired.
  // API-12 DECISION — `jobs` REMOVED from the manifest. Recurring work is handled by the
  // Netlify scheduled function expire-reservations.ts; nothing else queues background jobs.
  // No consumer exists or is planned, so the { state, scheduledFor } index earned nothing.
  { name: "rateLimits", indexes: [{ key: { key: 1, windowStart: 1 }, unique: true }, { key: { expiresAt: 1 }, expireAfterSeconds: 0 }] },
  { name: "roles", indexes: [{ key: { key: 1 }, unique: true }] },
  { name: "assistantConversations", indexes: [{ key: { chatId: 1 }, unique: true }, { key: { updatedAt: -1 } }] },
];

export async function applyDatabaseManifest(db: Db): Promise<void> {
  const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
  for (const collection of databaseManifest) {
    if (!existing.has(collection.name)) await db.createCollection(collection.name);
    if (collection.name === "sessions") await migrateSessionExpiryIndex(db);
    if (collection.name === "stockAlerts") await migrateStockAlertIndexes(db);
    if (collection.indexes?.length) await db.collection<Document>(collection.name).createIndexes(collection.indexes);
  }
}

/** API-05: drop the superseded `{ email, variantId }` unique index left by earlier manifests. */
async function migrateStockAlertIndexes(db: Db) {
  const stockAlerts = db.collection("stockAlerts");
  const indexes = await stockAlerts.listIndexes().toArray();
  if (indexes.some((index) => index.name === "email_1_variantId_1")) await stockAlerts.dropIndex("email_1_variantId_1");
}

async function migrateSessionExpiryIndex(db: Db) {
  const sessions = db.collection("sessions");
  const indexes = await sessions.listIndexes().toArray();
  if (indexes.some((index) => index.name === "expiresAt_1")) await sessions.dropIndex("expiresAt_1");
  await sessions.updateMany(
    { purgeAt: { $exists: false } },
    [{ $set: { purgeAt: { $ifNull: ["$absoluteExpiresAt", { $ifNull: ["$refreshExpiresAt", "$expiresAt"] }] } } }],
  );
}
