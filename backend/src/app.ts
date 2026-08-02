import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { requestContext } from "./middleware/request-context.js";
import { enforceOrigin } from "./middleware/origin.js";
import { apiRouter } from "./routes/index.js";
import { authenticateOptional } from "./middleware/auth.js";
import { enforceCsrf } from "./middleware/csrf.js";
import { rateLimit } from "./middleware/rate-limit.js";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", config.isProduction ? 1 : false);
  app.use(cookieParser());
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          imgSrc: ["'self'", "data:", "https:"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
          connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseapp.com", "https://securetoken.googleapis.com"],
          frameSrc: ["'self'", "https://accounts.google.com", "https://*.firebaseapp.com"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !origin || config.webOrigins.includes(origin)),
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "x-request-id", "x-csrf-token", "idempotency-key"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(authenticateOptional);
  app.use(enforceOrigin);
  app.use(enforceCsrf);
  app.use("/api/v1/auth/session", rateLimit({ name: "auth-session", limit: 10, windowMs: 15 * 60_000 }));
  app.use("/api/v1/auth/refresh", rateLimit({ name: "auth-refresh", limit: 30, windowMs: 15 * 60_000 }));
  app.use("/api/v1/catalog/products", rateLimit({ name: "catalog-search", limit: 60, windowMs: 60_000 }));
  app.use("/api/v1/cart", rateLimit({ name: "cart", limit: 120, windowMs: 60_000, principal: true, methods: ["POST", "PATCH", "PUT", "DELETE"] }));
  app.use("/api/v1/favorites", rateLimit({ name: "favorites", limit: 120, windowMs: 60_000, principal: true, methods: ["POST", "PATCH", "PUT", "DELETE"] }));
  app.use("/api/v1/orders", rateLimit({ name: "orders", limit: 60, windowMs: 60_000, principal: true }));
  app.use("/api/v1/admin", rateLimit({ name: "admin-mutations", limit: 120, windowMs: 60_000, principal: true, methods: ["POST", "PATCH", "PUT", "DELETE"] }));
  app.use("/api/v1/assistant", rateLimit({ name: "assistant", limit: 30, windowMs: 60_000, principal: true }));
  app.use("/api/v1/contact", rateLimit({ name: "contact", limit: 5, windowMs: 15 * 60_000 }));
  app.use("/api/v1/newsletter", rateLimit({ name: "newsletter", limit: 5, windowMs: 15 * 60_000 }));
  app.use("/api/v1", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
