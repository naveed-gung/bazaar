import type { Config } from "@netlify/functions";
import { getDb, getMongoClient } from "../../backend/src/database/client.js";

export default async function handler() {
  const db = await getDb();
  const now = new Date();
  const reservations = await db.collection("reservations").find({ state: "active", expiresAt: { $lte: now } }).limit(200).toArray();
  let expired = 0;
  for (const reservation of reservations) {
    const session = (await getMongoClient()).startSession();
    let claimed = false;
    try {
      await session.withTransaction(async () => {
        const result = await db.collection("reservations").updateOne(
          { _id: reservation._id, state: "active", expiresAt: { $lte: now } },
          { $set: { state: "expired", terminalAt: now, updatedAt: now }, $inc: { version: 1 } },
          { session },
        );
        if (!result.modifiedCount) return;
        const quantity = Number(reservation.quantity);
        const released = await db.collection("inventory").updateOne(
          { variantId: reservation.variantId, reserved: { $gte: quantity } },
          { $inc: { reserved: -quantity, version: 1 }, $set: { updatedAt: now } },
          { session },
        );
        if (!released.modifiedCount) throw new Error("Reservation inventory release invariant failed");
        await db.collection("inventoryLedger").updateOne(
          { idempotencyKey: `reservation-expire:${reservation._id.toString()}` },
          { $setOnInsert: { variantId: reservation.variantId, delta: 0, reservedDelta: -quantity, reason: "reservation_expired", actorId: "system", referenceId: reservation._id, idempotencyKey: `reservation-expire:${reservation._id.toString()}`, createdAt: now } },
          { upsert: true, session },
        );
        if (reservation.groupId) await db.collection("checkoutQuotes").updateOne({ _id: reservation.groupId, state: "active" }, { $set: { state: "expired", updatedAt: now } }, { session });
        claimed = true;
      });
    } finally {
      await session.endSession();
    }
    if (claimed) expired += 1;
  }
  return new Response(JSON.stringify({ expired }), { headers: { "content-type": "application/json" } });
}

export const config: Config = { schedule: "*/15 * * * *" };
