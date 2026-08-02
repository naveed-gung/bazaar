import type { NextFunction, Request, Response } from "express";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { issueGuestIdentity } from "./request-context.js";

const guestLifetime = 30 * 24 * 60 * 60 * 1000;

export async function requireActiveGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.principal.type === "user") {
    next();
    return;
  }
  try {
    const db = await getDb();
    const now = new Date();
    const session = await db.collection("guestSessions").findOneAndUpdate(
      { tokenHash: req.guestSessionHash },
      {
        $set: { lastSeenAt: now, expiresAt: new Date(now.getTime() + guestLifetime) },
        $setOnInsert: { tokenHash: req.guestSessionHash, state: "active", createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    if (session && session["state"] !== "active") {
      issueGuestIdentity(res);
      next(new AppError(401, "GUEST_SESSION_EXPIRED", "This guest session has already been linked. Refresh to start a new guest session."));
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
