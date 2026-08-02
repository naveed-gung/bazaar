import type { NextFunction, Request, Response } from "express";
import type { ApiProblem, FieldError } from "@bazaar/shared";
import { MongoNetworkError, MongoServerSelectionError } from "mongodb";
import { logger } from "./logger.js";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly errors?: FieldError[],
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  sendProblem(res, req, new AppError(404, "NOT_FOUND", "Resource not found."));
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;
  if (error instanceof AppError) {
    sendProblem(res, req, error);
    return;
  }

  if (isDatabaseUnavailable(error)) {
    logger.warn({ err: error, requestId: req.id }, "database unavailable");
    sendProblem(
      res,
      req,
      new AppError(503, "DATABASE_UNAVAILABLE", "The catalog database is temporarily unavailable."),
    );
    return;
  }

  logger.error({ err: error, requestId: req.id }, "unhandled request error");
  sendProblem(res, req, new AppError(500, "INTERNAL_ERROR", "Something went wrong."));
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof MongoServerSelectionError || error instanceof MongoNetworkError) return true;
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if (
      current.name.startsWith("Mongo") ||
      /server selection|replica set|ssl alert|tlsv1 alert/i.test(current.message)
    )
      return true;
    current = current.cause;
  }
  return false;
}

function sendProblem(res: Response, req: Request, error: AppError): void {
  const problem: ApiProblem = {
    type: `https://bazaa1.netlify.app/problems/${error.code.toLowerCase()}`,
    title: error.code.replaceAll("_", " "),
    status: error.status,
    code: error.code,
    detail: error.message,
    instance: String(req.id),
    ...(error.errors ? { errors: error.errors } : {}),
    ...(error.meta ? { meta: error.meta } : {}),
  };
  res.status(error.status).type("application/problem+json").json(problem);
}

declare global {
  // Express request augmentation requires declaration merging.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      principal: { type: "guest" | "user"; id: string; permissions: string[] };
      guestSessionHash: string;
      sessionHash?: string;
      sessionFamilyId?: string;
      csrfHash?: string;
    }
  }
}
