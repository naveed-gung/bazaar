import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

const safeRequestId = /^[a-zA-Z0-9._-]{8,100}$/;
const guestTokenPattern = /^[a-zA-Z0-9_-]{43}$/;
const guestCookie = "bazaar_guest";
const guestLifetime = 30 * 24 * 60 * 60 * 1000;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function issueGuestIdentity(res: Response) {
  const token = randomBytes(32).toString("base64url");
  res.cookie(guestCookie, token, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    maxAge: guestLifetime,
    path: "/",
  });
  return tokenHash(token);
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header("x-request-id") ?? "";
  req.id = safeRequestId.test(supplied) ? supplied : randomUUID();
  res.setHeader("x-request-id", req.id);

  const suppliedGuest = req.cookies?.[guestCookie] as string | undefined;
  const guestId = suppliedGuest && guestTokenPattern.test(suppliedGuest)
    ? tokenHash(suppliedGuest)
    : issueGuestIdentity(res);
  req.guestSessionHash = guestId;
  req.principal = {
    type: "guest",
    id: guestId,
    email: null,
    displayName: null,
    roles: [],
    permissions: [],
  };

  next();
}
