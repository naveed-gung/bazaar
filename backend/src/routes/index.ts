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
import { rbacRouter } from "./rbac.js";
import { assistantCatalogRouter } from "./assistant-catalog.js";
import { assistantChatRouter } from "./assistant-chat.js";
import { assistantTelegramRouter } from "./assistant-telegram.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ data: { status: "ok", version: "0.1.0", time: new Date().toISOString() } }));
apiRouter.get("/ready", asyncHandler(async (_req, res) => {
  const database = await checkDatabase();
  res.status(database ? 200 : 503).json({ data: { status: database ? "ready" : "degraded", dependencies: { database } } });
}));
apiRouter.use("/assistant/catalog", assistantCatalogRouter);
apiRouter.use("/assistant", assistantChatRouter);
apiRouter.use("/assistant", assistantTelegramRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", accountRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/media", mediaRouter);
// Role & user-role management. Same "/admin" prefix as adminRouter so the app-level admin
// rate limit applies; unmatched paths fall through from adminRouter to this router.
apiRouter.use("/admin", rbacRouter);
apiRouter.use("/catalog", catalogRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", orderRouter);
apiRouter.use(engagementRouter);
apiRouter.use(afterSalesRouter);
