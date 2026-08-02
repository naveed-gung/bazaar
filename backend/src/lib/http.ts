import type { NextFunction, Request, RequestHandler, Response } from "express";

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (req, res, next) => void handler(req, res, next).catch(next);
}

export function ownerKey(req: Request): string {
  return `${req.principal.type}:${req.principal.id}`;
}

export function parsePositiveInteger(value: unknown, fallback = 1, max = 99): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}
