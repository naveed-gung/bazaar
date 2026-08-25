import { type Document, type Sort } from "mongodb";
import { Router, type Request } from "express";
import { getDb } from "../database/client.js";
import { AppError } from "../errors.js";
import { inventoryByProduct, serializeProduct, type ProductDocument } from "../domain/catalog.js";
import { asyncHandler, ownerKey } from "../lib/http.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { CatalogFacets, FacetBucket, SuggestionDto } from "@bazaar/shared";

export const catalogRouter = Router();

const AVAILABILITY_TIERS = ["in_stock", "low_stock", "out_of_stock"] as const;
type AvailabilityTier = (typeof AVAILABILITY_TIERS)[number];
const SORT_TOKENS = ["newest", "price-asc", "price-desc", "rating"] as const;

catalogRouter.get("/categories", asyncHandler(async (_req, res) => {
  const db = await getDb();
  const categories = await db.collection("categories").find({ state: "published" }).sort({ name: 1 }).toArray();
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ data: categories.map((item) => ({ id: item._id.toString(), slug: item.slug, name: item.name, imageUrl: item.imageUrl })) });
}));

// ------------------------------------------------------------------ API-02 suggest

catalogRouter.get("/suggest", rateLimit({ name: "catalog-suggest", limit: 90, windowMs: 60_000 }), asyncHandler(async (req, res) => {
  const raw = typeof req.query["q"] === "string" ? req.query["q"].trim() : "";
  if (raw.length > 100) throw new AppError(422, "QUERY_TOO_LONG", "Search terms must be 100 characters or fewer.");
  const suggestions: SuggestionDto[] = [];
  if (raw.length >= 2) {
    const db = await getDb();
    const pattern = new RegExp(`^${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const [products, categories] = await Promise.all([
      db.collection("products").find({ state: "published", $or: [{ name: pattern }, { brand: pattern }] })
        .sort({ reviewCount: -1, rating: -1 }).limit(8)
        .project<{ slug: string; name: string; brand: string; priceMinor: number; imageUrl: string }>({ slug: 1, name: 1, brand: 1, priceMinor: 1, imageUrl: 1 })
        .toArray(),
      db.collection("categories").find({ state: "published", $or: [{ name: pattern }, { slug: pattern }] })
        .sort({ name: 1 }).limit(4)
        .project<{ slug: string; name: string }>({ slug: 1, name: 1 })
        .toArray(),
    ]);
    for (const product of products) suggestions.push({ type: "product", slug: product.slug, name: product.name, brand: product.brand, priceMinor: product.priceMinor, imageUrl: product.imageUrl });
    for (const category of categories) suggestions.push({ type: "category", slug: category.slug, name: category.name });
    for (const brand of [...new Set(products.map((item) => item.brand).filter((name) => pattern.test(name)))].slice(0, 6)) suggestions.push({ type: "brand", name: brand });
    // Fire-and-forget analytics write: a logging failure must never fail the search, and the
    // response must never wait on it. No IP, no PII beyond the query itself.
    void db.collection("searchRequests").insertOne({
      normalizedQuery: raw.toLowerCase().slice(0, 120),
      resultCount: suggestions.length,
      ownerKey: ownerKey(req),
      createdAt: new Date(),
    }).catch(() => undefined);
  }
  res.setHeader("cache-control", "public, max-age=15, stale-while-revalidate=30");
  res.json({ data: suggestions });
}));

// ------------------------------------------------------------------ API-01 faceted listing

type CatalogFilters = {
  q: string;
  category: string;
  badge: string;
  sort: Sort;
  page: number;
  limit: number;
  brands: string[];
  minPrice: number | null;
  maxPrice: number | null;
  rating: number | null;
  availability: AvailabilityTier[];
  options: { name: string; values: string[] }[];
};

type AggregatedProduct = ProductDocument & { quantityAvailable: number; priceMin: number; priceMax: number };

type FacetAggregate = {
  results?: AggregatedProduct[];
  total?: { value: number }[];
  brands?: { _id: unknown; count: number }[];
  categories?: { _id: unknown; count: number }[];
  options?: { _id?: { name?: unknown; value?: unknown }; count: number }[];
  priceRange?: { min: number | null; max: number | null }[];
};

/**
 * One variant row per active variant with its sellable stock, so every downstream branch can
 * filter on the real variant price range and availability without re-querying variants +
 * inventory by hand (TASK-01's rule).
 */
const ENRICHMENT_STAGES: Document[] = [
  { $lookup: {
    from: "variants",
    let: { productId: "$_id" },
    pipeline: [
      { $match: { $expr: { $eq: ["$productId", "$$productId"] }, state: "active" } },
      { $lookup: { from: "inventory", localField: "_id", foreignField: "variantId", as: "inv" } },
      { $project: { _id: 0, priceMinor: 1, stock: { $max: [0, { $subtract: [{ $ifNull: [{ $first: "$inv.onHand" }, 0] }, { $ifNull: [{ $first: "$inv.reserved" }, 0] }] }] } } },
    ],
    as: "waveStock",
  } },
  { $addFields: {
    quantityAvailable: { $sum: "$waveStock.stock" },
    priceMin: { $cond: [{ $gt: [{ $size: "$waveStock" }, 0] }, { $min: "$waveStock.priceMinor" }, "$priceMinor"] },
    priceMax: { $cond: [{ $gt: [{ $size: "$waveStock" }, 0] }, { $max: "$waveStock.priceMinor" }, "$priceMinor"] },
  } },
];

/** Mirrors availabilityOf(): <= 0 out of stock, <= 5 low stock, otherwise in stock. */
function availabilityClause(tier: AvailabilityTier): Record<string, unknown> {
  if (tier === "out_of_stock") return { quantityAvailable: { $lte: 0 } };
  if (tier === "low_stock") return { quantityAvailable: { $gt: 0, $lte: 5 } };
  return { quantityAvailable: { $gt: 5 } };
}

/**
 * Post-enrichment match for a facet branch. Each branch re-applies every active filter EXCEPT
 * its own dimension, so counts always reflect the other narrowed choices.
 */
function dimensionMatch(filters: CatalogFilters, skip: "none" | "brand" | "category" | "option" | "price"): Record<string, unknown> {
  const clauses: Record<string, unknown>[] = [];
  if (skip !== "brand" && filters.brands.length) clauses.push({ brand: { $in: filters.brands } });
  if (skip !== "category" && filters.category) clauses.push({ categorySlug: filters.category });
  if (filters.rating !== null) clauses.push({ rating: { $gte: filters.rating } });
  if (skip !== "price") {
    if (filters.minPrice !== null) clauses.push({ priceMax: { $gte: filters.minPrice } });
    if (filters.maxPrice !== null) clauses.push({ priceMin: { $lte: filters.maxPrice } });
  }
  if (filters.availability.length === 1) clauses.push(availabilityClause(filters.availability[0]!));
  else if (filters.availability.length > 1) clauses.push({ $or: filters.availability.map(availabilityClause) });
  if (skip !== "option") {
    for (const option of filters.options) clauses.push({ options: { $elemMatch: { name: option.name, values: { $in: option.values } } } });
  }
  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { $and: clauses };
}

/**
 * Pre-$facet match shared by every branch. Only non-faceted dimensions live here (state,
 * badge, text search): the category filter must stay OUT of the base match because the
 * categories facet counts against the OTHER active filters — every branch re-applies the
 * dimensions it needs selectively via dimensionMatch().
 */
function baseFilterOf(filters: CatalogFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = { state: "published" };
  if (filters.badge) filter["badge"] = filters.badge;
  if (filters.q) filter["$text"] = { $search: filters.q };
  return filter;
}

function scalarQuery(req: Request, key: string): string | null {
  const value = req.query[key];
  if (value === undefined) return null;
  if (typeof value !== "string") throw new AppError(422, "FILTER_INVALID", `The ${key} parameter is malformed.`);
  return value.trim();
}

function listQuery(req: Request, key: string): string[] {
  const value = req.query[key];
  if (value === undefined) return [];
  if (typeof value === "string") return [value.trim()];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return (value as string[]).map((item) => item.trim());
  throw new AppError(422, "FILTER_INVALID", `The ${key} parameter is malformed.`);
}

function strictPositiveInteger(raw: string | null, label: string, fallback: number, max: number): number {
  if (raw === null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new AppError(422, "FILTER_INVALID", `The ${label} parameter must be a positive integer.`);
  return Math.min(parsed, max);
}

function parseMinorUnits(raw: string, label: string): number {
  if (!/^\d{1,9}$/.test(raw)) throw new AppError(422, "FILTER_INVALID", `The ${label} filter must be a whole number of minor units.`);
  return Number(raw);
}

function parseCatalogFilters(req: Request): CatalogFilters {
  const reserved = new Set(["q", "category", "badge", "sort", "page", "limit", "minPrice", "maxPrice", "brand", "rating", "availability"]);
  const optionNames: string[] = [];
  for (const key of Object.keys(req.query)) {
    if (reserved.has(key)) continue;
    if (key.startsWith("option.")) { optionNames.push(key.slice("option.".length)); continue; }
    throw new AppError(422, "UNKNOWN_FILTER", `The ${key} parameter is not supported.`);
  }
  const q = scalarQuery(req, "q") ?? "";
  if (q.length > 100) throw new AppError(422, "QUERY_TOO_LONG", "Search terms must be 100 characters or fewer.");
  const category = scalarQuery(req, "category") ?? "";
  if (category && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) throw new AppError(422, "FILTER_INVALID", "The category filter is invalid.");
  const badge = scalarQuery(req, "badge") ?? "";
  if (badge && badge !== "New" && badge !== "Deal") throw new AppError(422, "FILTER_INVALID", "The badge filter is invalid.");
  const sortToken = scalarQuery(req, "sort") ?? "newest";
  if (!(SORT_TOKENS as readonly string[]).includes(sortToken)) throw new AppError(422, "FILTER_INVALID", "The sort value is invalid.");
  const sort: Sort = sortToken === "price-asc" ? { priceMinor: 1 } : sortToken === "price-desc" ? { priceMinor: -1 } : sortToken === "rating" ? { rating: -1, reviewCount: -1 } : { publishedAt: -1 };
  const brands = [...new Set(listQuery(req, "brand").filter(Boolean))];
  if (brands.some((brand) => brand.length > 80) || brands.length > 20) throw new AppError(422, "FILTER_INVALID", "The brand filter is invalid.");
  const minPriceRaw = scalarQuery(req, "minPrice");
  const maxPriceRaw = scalarQuery(req, "maxPrice");
  const minPrice = minPriceRaw === null || minPriceRaw === "" ? null : parseMinorUnits(minPriceRaw, "minPrice");
  const maxPrice = maxPriceRaw === null || maxPriceRaw === "" ? null : parseMinorUnits(maxPriceRaw, "maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new AppError(422, "FILTER_INVALID", "The price range is inverted.");
  const ratingRaw = scalarQuery(req, "rating");
  let rating: number | null = null;
  if (ratingRaw !== null && ratingRaw !== "") {
    rating = Number(ratingRaw);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError(422, "FILTER_INVALID", "The rating filter must be an integer from one to five.");
  }
  const availabilityRaw = listQuery(req, "availability").filter(Boolean);
  for (const tier of availabilityRaw) {
    if (!(AVAILABILITY_TIERS as readonly string[]).includes(tier)) throw new AppError(422, "FILTER_INVALID", "The availability filter is invalid.");
  }
  const availability = [...new Set(availabilityRaw)] as AvailabilityTier[];
  if (optionNames.length > 10) throw new AppError(422, "FILTER_INVALID", "At most ten option filters are allowed.");
  const options = optionNames.map((name) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9 _&'-]{0,60}$/.test(name)) throw new AppError(422, "FILTER_INVALID", `The ${name} option filter is invalid.`);
    const values = [...new Set(listQuery(req, `option.${name}`).filter(Boolean))];
    if (!values.length || values.some((value) => value.length > 60) || values.length > 20) throw new AppError(422, "FILTER_INVALID", `The ${name} option filter is invalid.`);
    return { name, values };
  });
  return { q, category, badge, sort, page: strictPositiveInteger(scalarQuery(req, "page"), "page", 1, 100), limit: strictPositiveInteger(scalarQuery(req, "limit"), "limit", 24, 100), brands, minPrice, maxPrice, rating, availability, options };
}

function withOptionalMatch(match: Record<string, unknown>, stages: Document[]): Document[] {
  return Object.keys(match).length ? [{ $match: match }, ...stages] : stages;
}

catalogRouter.get("/products", asyncHandler(async (req, res) => {
  const filters = parseCatalogFilters(req);
  const db = await getDb();
  const allMatch = dimensionMatch(filters, "none");
  const facetStages: Record<string, Document[]> = {
    results: withOptionalMatch(allMatch, [
      { $sort: filters.sort },
      { $skip: (filters.page - 1) * filters.limit },
      { $limit: filters.limit },
    ]),
    total: withOptionalMatch(allMatch, [{ $count: "value" }]),
    brands: withOptionalMatch(dimensionMatch(filters, "brand"), [
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 40 },
    ]),
    categories: withOptionalMatch(dimensionMatch(filters, "category"), [
      { $group: { _id: "$categorySlug", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 40 },
    ]),
    options: withOptionalMatch(dimensionMatch(filters, "option"), [
      { $unwind: "$options" },
      { $unwind: "$options.values" },
      { $group: { _id: { name: "$options.name", value: "$options.values" }, count: { $sum: 1 } } },
      { $sort: { "_id.name": 1, count: -1 } },
      { $limit: 400 },
    ]),
    priceRange: withOptionalMatch(dimensionMatch(filters, "price"), [
      { $group: { _id: null, min: { $min: "$priceMin" }, max: { $max: "$priceMax" } } },
    ]),
  };
  const [facet] = await db.collection<ProductDocument>("products").aggregate<FacetAggregate>([
    { $match: baseFilterOf(filters) },
    ...ENRICHMENT_STAGES,
    { $facet: facetStages },
  ]).toArray();
  if (!facet) throw new AppError(500, "CATALOG_UNAVAILABLE", "The catalogue query could not be completed.");

  const rows = facet.results ?? [];
  const inventories = await inventoryByProduct(db, rows.map((row) => row._id));
  const categoryDocs = await db.collection("categories").find({ state: "published" }).project<{ slug: string; name: string }>({ slug: 1, name: 1 }).toArray();
  const categoryLabels = new Map(categoryDocs.map((item) => [item.slug, item.name]));
  const bucketOf = (rowsIn: { _id: unknown; count: number }[], labelFrom?: (value: string) => string | undefined): FacetBucket[] =>
    rowsIn.filter((row) => typeof row._id === "string" && row._id !== "").map((row) => {
      const value = row._id as string;
      return { value, label: labelFrom?.(value) ?? value, count: row.count };
    });
  const optionGroups = new Map<string, FacetBucket[]>();
  for (const row of facet.options ?? []) {
    const name = row._id?.name;
    const value = row._id?.value;
    if (typeof name !== "string" || typeof value !== "string") continue;
    const buckets = optionGroups.get(name) ?? [];
    buckets.push({ value, label: value, count: row.count });
    optionGroups.set(name, buckets);
  }
  const facets: CatalogFacets = {
    brands: bucketOf(facet.brands ?? []),
    categories: bucketOf(facet.categories ?? [], (slug) => categoryLabels.get(slug)),
    options: [...optionGroups.entries()].map(([name, buckets]) => ({ name, buckets })),
    priceMinor: { min: facet.priceRange?.[0]?.min ?? 0, max: facet.priceRange?.[0]?.max ?? 0 },
  };
  const total = facet.total?.[0]?.value ?? 0;
  res.setHeader("cache-control", "public, max-age=30, stale-while-revalidate=120");
  res.json({
    data: {
      items: rows.map((row) => serializeProduct(row, inventories.get(row._id.toHexString()) ?? 0)),
      page: filters.page,
      limit: filters.limit,
      pageSize: filters.limit,
      total,
      pages: Math.ceil(total / filters.limit),
      facets,
    },
  });
}));

catalogRouter.get("/products/:slug", asyncHandler(async (req, res) => {
  const db = await getDb();
  const product = await db.collection<ProductDocument>("products").findOne({ slug: String(req.params["slug"] ?? ""), state: "published" });
  if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  const variant = await db.collection("variants").findOne({ productId: product._id, state: "active" });
  const inventory = variant ? await db.collection("inventory").findOne({ variantId: variant._id }) : null;
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=300");
  res.json({ data: { ...serializeProduct(product, Math.max(0, Number(inventory?.["onHand"] ?? 0) - Number(inventory?.["reserved"] ?? 0))), variants: variant ? [{ id: variant._id.toString(), sku: variant["sku"], name: variant["name"], options: variant["options"], availability: inventory ? Math.max(0, Number(inventory["onHand"]) - Number(inventory["reserved"])) : 0 }] : [] } });
}));
