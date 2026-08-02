import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors.js";
import { config } from "../config.js";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

export function enforceOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  const origin = req.header("origin");
  if (!origin || !config.webOrigins.includes(origin)) {
    next(new AppError(403, "ORIGIN_REJECTED", "Request origin is not allowed."));
    return;
  }
  next();
}
