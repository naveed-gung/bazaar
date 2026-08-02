import { MongoClient, type Db } from "mongodb";
import { setServers } from "node:dns";
import { config } from "../config.js";
import { logger } from "../logger.js";

let clientPromise: Promise<MongoClient> | undefined;

export function getMongoClient(): Promise<MongoClient> {
  if (!clientPromise) {
    if (config.mongoDnsServers.length > 0) setServers(config.mongoDnsServers);
    const client = new MongoClient(config.mongoUri, {
      appName: "bazaar-api",
      maxPoolSize: 20,
      minPoolSize: 0,
      retryWrites: true,
      serverSelectionTimeoutMS: 10_000,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      throw error;
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(config.mongoDbName);
}

export async function checkDatabase(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1, maxTimeMS: 3_000 });
    return true;
  } catch (error) {
    logger.warn({ err: error }, "database readiness check failed");
    return false;
  }
}

export async function closeDatabase(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  clientPromise = undefined;
  await client.close();
}
