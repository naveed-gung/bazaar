import { Router } from "express";
import { checkDatabase } from "../database/client.js";
import { asyncHandler } from "../lib/http.js";
import { catalogRouter } from "./catalog.js";
import { cartRouter } from "./cart.js";
import { orderRouter } from "./orders.js";
import { engagementRouter } from "./engagement.js";
import { authRouter } from "./auth.js";
import { accountRouter } from "./account.js";
import { adminRouter } from "./admin.js";
import { afterSalesRouter } from "./after-sales.js";
import { mediaRouter } from "./media.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ data: { status: "ok", version: "0.1.0", time: new Date().toISOString() } }));
apiRouter.get("/ready", asyncHandler(async (_req, res) => {
  const database = await checkDatabase();
  res.status(database ? 200 : 503).json({ data: { status: database ? "ready" : "degraded", dependencies: { database } } });
}));
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", accountRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use(engagementRouter);
apiRouter.use(afterSalesRouter);
