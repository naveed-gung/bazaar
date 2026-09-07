import { randomUUID } from "node:crypto";
import { getDb, getMongoClient, closeDatabase } from "./client.js";
import { applyDatabaseManifest, databaseManifest } from "./manifest.js";
import { logger } from "../logger.js";

async function main() {
  const db = await getDb();
  await applyDatabaseManifest(db);

  const client = await getMongoClient();
  const session = client.startSession();
  const smokeId = `smoke_${randomUUID()}`;
  try {
    await session.withTransaction(async () => {
      await db.collection("auditLogs").insertOne({ smokeId, createdAt: new Date() }, { session });
      await db.collection("inventoryLedger").insertOne({ idempotencyKey: smokeId, smokeId, createdAt: new Date() }, { session });
      await db.collection("auditLogs").deleteOne({ smokeId }, { session });
      await db.collection("inventoryLedger").deleteOne({ smokeId }, { session });
    });
    logger.info({ collections: databaseManifest.length }, "database manifest and transaction smoke test passed");
  } finally {
    await session.endSession();
    await closeDatabase();
  }
}

void main().catch((error) => {
  logger.fatal({ err: error }, "database bootstrap failed");
  process.exitCode = 1;
});
void main()
  .then(() => {
    process.exit(0);
  })
  .catch(async (error) => {
    logger.fatal({ err: error }, "database bootstrap failed");
    await closeDatabase().catch(() => {});
    process.exit(1);
  });
