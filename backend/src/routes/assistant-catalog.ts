import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { ObjectId, type Filter, type Document } from "mongodb";
import { getDb } from "../database/client.js";
import { asyncHandler } from "../lib/http.js";
import { config } from "../config.js";
import {
  inventoryByProduct,
  variantsWithStock,
  type ProductDocument,
} from "../domain/catalog.js";

export const assistantCatalogRouter = Router();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bearer token authentication middleware for Loom by Auvia assistant bot tools.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifyAssistantBotAuth(req: Request, res: Response, next: NextFunction): void {
  const configuredToken = config.bazaarBotToken;
  if (!configuredToken) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Assistant bot token is not configured on the server.",
      },
    });
    return;
  }

  const authHeader = req.header("authorization") || "";
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!match) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Missing or malformed Authorization header. Expected 'Bearer <token>'.",
      },
    });
    return;
  }

  const suppliedToken = match[1] ?? "";
  const expectedBuf = Buffer.from(configuredToken);
  const suppliedBuf = Buffer.from(suppliedToken);

  if (expectedBuf.length !== suppliedBuf.length || !timingSafeEqual(expectedBuf, suppliedBuf)) {
    res.status(401).json({
      error: {
        code: "unauthorized",
        message: "Invalid assistant bot token.",
      },
    });
    return;
  }

  next();
}

assistantCatalogRouter.use(verifyAssistantBotAuth);

/**
 * GET /api/v1/assistant/catalog/search
 * Search published products with live inventory availability and pricing.
 */
assistantCatalogRouter.get(
  "/search",
  asyncHandler(async (req: Request, res: Response) => {
    const q = typeof req.query["q"] === "string" ? req.query["q"].trim().slice(0, 100) : "";
    const category =
      typeof req.query["category"] === "string" ? req.query["category"].trim().slice(0, 60) : "";
    const inStockOnly =
      req.query["inStockOnly"] === "true" || req.query["inStockOnly"] === "1";

    let limit = 5;
    if (typeof req.query["limit"] === "string" && /^\d+$/.test(req.query["limit"])) {
      limit = Math.max(1, Math.min(10, parseInt(req.query["limit"], 10)));
    }

    const filter: Filter<Document> = { state: "published" };

    if (category) {
      filter["$or"] = [
        { categorySlug: category.toLowerCase() },
        { category: new RegExp(`^${escapeRegex(category)}$`, "i") },
      ];
    }

    if (q) {
      const qRegex = new RegExp(escapeRegex(q), "i");
      const textMatch = [
        { name: qRegex },
        { brand: qRegex },
        { blurb: qRegex },
        { category: qRegex },
      ];
      if (filter["$or"]) {
        filter["$and"] = [{ $or: filter["$or"] }, { $or: textMatch }];
        delete filter["$or"];
      } else {
        filter["$or"] = textMatch;
      }
    }

    const db = await getDb();
    // Over-fetch slightly to allow in-stock filtering before capping at limit
    const fetchLimit = inStockOnly ? Math.min(40, limit * 4) : limit;
    const products = (await db
      .collection("products")
      .find(filter)
      .limit(fetchLimit)
      .toArray()) as unknown as ProductDocument[];

    const productIds = products.map((p) => p._id);
    const stockMap = await inventoryByProduct(db, productIds);

    const domain = config.bazaarPublicDomain;
    const results = [];

    for (const product of products) {
      const availableQty = stockMap.get(product._id.toString()) ?? 0;
      const inStock = availableQty > 0;

      if (inStockOnly && !inStock) {
        continue;
      }

      results.push({
        id: product._id.toHexString(),
        slug: product.slug,
        name: product.name,
        category: product.categorySlug || product.category,
        priceMinor: product.priceMinor,
        currency: "USD",
        inStock,
        availableQty,
        url: `https://${domain}/p/${product.slug}`,
      });

      if (results.length >= limit) {
        break;
      }
    }

    res.json({
      results,
      asOf: new Date().toISOString(),
    });
  }),
);

/**
 * GET /api/v1/assistant/catalog/product
 * Get full product detail and live variant breakdown.
 */
assistantCatalogRouter.get(
  "/product",
  asyncHandler(async (req: Request, res: Response) => {
    const idParam = typeof req.query["id"] === "string" ? req.query["id"].trim() : "";
    if (!idParam) {
      res.status(422).json({
        error: {
          code: "validation_failed",
          message: "The 'id' query parameter is required.",
        },
      });
      return;
    }

    const db = await getDb();
    const isObjId = ObjectId.isValid(idParam) && idParam.length === 24;
    const query: Filter<Document> = isObjId
      ? { $or: [{ _id: new ObjectId(idParam) }, { slug: idParam }], state: "published" }
      : { slug: idParam, state: "published" };

    const product = (await db
      .collection("products")
      .findOne(query)) as unknown as ProductDocument | null;

    if (!product) {
      res.status(404).json({
        error: {
          code: "not_found",
          message: `Product '${idParam}' not found.`,
        },
      });
      return;
    }

    const variantsStock = await variantsWithStock(db, product._id);
    const totalStock = variantsStock.reduce((sum, v) => sum + v.quantityAvailable, 0);

    const variants = variantsStock.map(({ variant, quantityAvailable }) => ({
      id: variant._id.toHexString(),
      sku: variant.sku,
      name: variant.name,
      options: variant.options ?? {},
      priceMinor: variant.priceMinor,
      currency: "USD",
      inStock: quantityAvailable > 0,
      availableQty: quantityAvailable,
    }));

    const minPrice = variants.length
      ? Math.min(...variants.map((v) => v.priceMinor))
      : product.priceMinor;

    const domain = config.bazaarPublicDomain;

    res.json({
      id: product._id.toHexString(),
      slug: product.slug,
      name: product.name,
      category: product.categorySlug || product.category,
      priceMinor: minPrice,
      currency: "USD",
      inStock: totalStock > 0,
      availableQty: totalStock,
      url: `https://${domain}/p/${product.slug}`,
      variants,
      asOf: new Date().toISOString(),
    });
  }),
);
