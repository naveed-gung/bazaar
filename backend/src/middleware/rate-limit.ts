import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { MongoServerError } from "mongodb";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  principal?: boolean;
  methods?: string[];
};

export function rateLimit({ name, limit, windowMs, principal = false, methods }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (methods && !methods.includes(req.method)) {
      next();
      return;
    }
    try {
      const now = Date.now();
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const identity = principal ? `${req.principal.type}:${req.principal.id}` : req.ip || "unknown";
      const key = createHash("sha256").update(`${name}:${identity}`).digest("hex");
      const db = await getDb();
      const selector = { key, windowStart: new Date(windowStartMs) };
      let record;
      try {
        record = await db.collection("rateLimits").findOneAndUpdate(
          selector,
          {
            $inc: { count: 1 },
            $setOnInsert: {
              key,
              windowStart: selector.windowStart,
              expiresAt: new Date(windowStartMs + windowMs * 2),
            },
          },
          { upsert: true, returnDocument: "after" },
        );
      } catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
        record = await db.collection("rateLimits").findOneAndUpdate(
          selector,
          { $inc: { count: 1 } },
          { returnDocument: "after" },
        );
      }
      const remaining = Math.max(0, limit - Number(record?.["count"] ?? 1));
      const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000));
      res.setHeader("RateLimit-Limit", String(limit));
      res.setHeader("RateLimit-Remaining", String(remaining));
      res.setHeader("RateLimit-Reset", String(retryAfter));
      if (Number(record?.["count"] ?? 1) > limit) {
        res.setHeader("Retry-After", String(retryAfter));
        next(new AppError(429, "RATE_LIMITED", "Too many requests. Please try again shortly.", undefined, { retryAfter }));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
