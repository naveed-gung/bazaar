import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function enforceCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (safeMethods.has(req.method) || req.principal.type !== "user" || req.path === "/api/v1/auth/session") { next(); return; }
  const cookie = req.cookies?.["bazaar_csrf"] as string | undefined;
  const header = req.header("x-csrf-token");
  const cookieHash = cookie ? createHash("sha256").update(cookie).digest("hex") : "";
  const sameToken = Boolean(cookie && header && cookie.length === header.length && timingSafeEqual(Buffer.from(cookie), Buffer.from(header)));
  const sessionBound = Boolean(req.csrfHash && cookieHash.length === req.csrfHash.length && timingSafeEqual(Buffer.from(cookieHash), Buffer.from(req.csrfHash)));
  if (!sameToken || !sessionBound) {
    next(new AppError(403, "CSRF_REJECTED", "The request security token is invalid."));
    return;
  }
  next();
}
