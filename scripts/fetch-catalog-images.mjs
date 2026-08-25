/**
 * Resolves and downloads product photography for every entry in
 * `backend/src/database/catalog-data.ts`.
 *
 *   node scripts/fetch-catalog-images.mjs            # resolve missing, download missing
 *   node scripts/fetch-catalog-images.mjs --resolve  # only refresh the manifest, no downloads
 *   node scripts/fetch-catalog-images.mjs --force    # re-encode files that already exist
 *   node scripts/fetch-catalog-images.mjs --refresh  # re-pick photos, ignoring the manifest
 *   node scripts/fetch-catalog-images.mjs --only a,b # restrict to these slugs
 *
 * Selections are pinned in `scripts/catalog-images.json` so a re-run is reproducible and does
 * not burn the 200-requests-per-hour search quota. Photos are downloaded once, cropped 4:5 and
 * written as WebP at three widths, and every photographer is recorded in
 * `frontend/public/catalog/CREDITS.md`.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readApiKey, searchPhotos, toCredit, usable } from "./lib/pexels.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(ROOT, "scripts", "catalog-images.json");
const OUT_DIR = join(ROOT, "frontend", "public", "catalog");
/**
 * 1200 px covers a 600 px CSS gallery hero at 2x DPR, which is what the editorial product
 * layout uses. A 1600 px tier tripled the repo weight for detail nothing on the page renders.
 */
const WIDTHS = [1200, 800, 400];
const QUALITY = { 1200: 72, 800: 72, 400: 70 };
const ASPECT = 4 / 5;
const IMAGES_PER_PRODUCT = 3;
/**
 * A gallery of two genuine photos beats three where one is wrong, so a product that cannot
 * fill every slot ships short rather than padding with whatever the search ranked next.
 */
const MIN_IMAGES_PER_PRODUCT = 2;
const PER_PAGE = 40;

const args = process.argv.slice(2);
const flags = new Set(args.filter((entry) => entry.startsWith("--")));
const RESOLVE_ONLY = flags.has("--resolve");
const FORCE = flags.has("--force");
const REFRESH = flags.has("--refresh");
const ONLY = new Set(
  args
    .filter((entry) => entry.startsWith("--only"))
    .flatMap((entry) => entry.split("=")[1]?.split(",") ?? [])
    .filter(Boolean),
);

/**
 * Photos whose subject is a recognisable real brand fight with our fictional house labels,
 * so they sink in the ranking rather than being rejected outright — some categories would
 * otherwise have nothing left to choose from.
 */
const BRAND_WORDS =
  /\b(apple|iphone|ipad|macbook|samsung|galaxy|sony|canon|nikon|fuji|nintendo|xbox|playstation|dell|hp|lenovo|asus|logitech|bose|beats|sennheiser|jbl|xiaomi|huawei|google pixel|gopro|dji|oppo|sandisk|kingston|seagate|realme|vivo|oneplus)\b/i;

/**
 * Homograph traps the subject filter would otherwise walk into: a "tablet" is also medicine,
 * and a "monitor" is also a hospital vital-signs display.
 */
const NEGATIVE_WORDS =
  /\b(pills?|blister|medicine|medication|medical|pharmac\w*|capsules?|vitamin|supplement|antibiotic|paracetamol|ibuprofen|aspirin|drugs?|dosage|prescription|hospital|patient|nurse|doctor)\b/i;

/** Products are parsed out of the TypeScript source so there is a single catalogue definition. */
function loadProducts() {
  const source = readFileSync(join(ROOT, "backend", "src", "database", "catalog-data.ts"), "utf8");
  const body = source.slice(source.indexOf("export const PRODUCTS"));
  const products = [];
  const slugPattern = /^ {4}slug: "([a-z0-9-]+)",$/gm;
  for (const match of body.matchAll(slugPattern)) {
    const rest = body.slice(match.index);
    const name = /^ {4}name: "(.+)",$/m.exec(rest)?.[1];
    const queryBlock = /^ {4}imageQuery: \[(.+)\],$/m.exec(rest)?.[1];
    const subjectBlock = /^ {4}imageSubject: \[(.+)\],$/m.exec(rest)?.[1];
    if (!name || !queryBlock || !subjectBlock) {
      throw new Error(`Could not parse name/imageQuery/imageSubject for ${match[1]}`);
    }
    const strings = (block) => [...block.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]);
    products.push({
      slug: match[1],
      name,
      queries: strings(queryBlock),
      subjects: strings(subjectBlock).map((term) => term.toLowerCase()),
    });
  }
  return products;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return {};
  // `--refresh` alone re-picks everything; combined with `--only` it re-picks just those slugs.
  if (REFRESH && !ONLY.size) return {};
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  if (REFRESH) for (const slug of ONLY) delete manifest[slug];
  return manifest;
}

/**
 * The single most important filter. Pexels happily returns a mixing desk for "studio monitor
 * speaker" and a yoga mat for "vr headset" — geometry-based ranking cannot tell the difference,
 * but the alt text can.
 */
function onSubject(photo, subjects) {
  const alt = (photo.alt ?? "").toLowerCase();
  if (!alt) return false;
  if (NEGATIVE_WORDS.test(alt)) return false;
  return subjects.some((term) => alt.includes(term));
}

/**
 * Search-result position dominates: Pexels relevance ordering knows more about what a photo
 * depicts than any aspect-ratio heuristic. Geometry only breaks ties between photos that are
 * already on-subject.
 */
function score({ photo, rank }) {
  const aspect = photo.width / photo.height;
  let value = 100 - rank * 1.5;
  value -= Math.abs(aspect - ASPECT) * 12;
  if (aspect < 1) value += 6; // portrait crops to 4:5 with the least loss
  if (BRAND_WORDS.test(photo.alt ?? "")) value -= 40;
  return value;
}

/** Walks a product's query phrases until it has enough distinct, on-subject photos. */
async function resolveProduct(apiKey, product, taken) {
  const onTopic = new Map();
  for (const [queryIndex, query] of product.queries.entries()) {
    const photos = await searchPhotos(apiKey, query, { perPage: PER_PAGE });
    for (const [position, photo] of photos.entries()) {
      if (!usable(photo) || taken.has(photo.id)) continue;
      if (!onSubject(photo, product.subjects)) continue;
      // Later query phrases are less specific, so their hits start further down the ranking.
      if (!onTopic.has(photo.id)) onTopic.set(photo.id, { photo, rank: queryIndex * 12 + position });
    }
    if (onTopic.size >= IMAGES_PER_PRODUCT * 3) break;
  }
  const ranked = [...onTopic.values()].sort((a, b) => score(b) - score(a));
  if (ranked.length < MIN_IMAGES_PER_PRODUCT) {
    throw new Error(
      `${product.slug}: only ${ranked.length} on-subject photo(s). Widen imageQuery or imageSubject in catalog-data.ts.`,
    );
  }
  if (ranked.length < IMAGES_PER_PRODUCT) {
    console.warn(`  ! ${product.slug}: shipping ${ranked.length} images, not ${IMAGES_PER_PRODUCT}`);
  }
  return ranked.slice(0, IMAGES_PER_PRODUCT).map((entry) => toCredit(entry.photo));
}

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

/** Crops to 4:5 and writes one WebP per width. Returns bytes written. */
async function encode(buffer, slug, index) {
  const dir = join(OUT_DIR, slug);
  mkdirSync(dir, { recursive: true });
  let bytes = 0;
  for (const width of WIDTHS) {
    const file = join(dir, `${String(index + 1).padStart(2, "0")}-${width}.webp`);
    if (existsSync(file) && !FORCE) {
      bytes += statSync(file).size;
      continue;
    }
    await sharp(buffer)
      .resize(width, Math.round(width / ASPECT), { fit: "cover", position: "attention" })
      .webp({ quality: QUALITY[width], effort: 6 })
      .toFile(file);
    bytes += statSync(file).size;
  }
  return bytes;
}

function writeCredits(products, manifest) {
  const lines = [
    "# Catalogue photography credits",
    "",
    "Every product photo comes from [Pexels](https://www.pexels.com). The Pexels licence allows",
    "free use and modification without attribution; this file exists anyway so each photographer",
    "is named. Images are cropped to 4:5 and re-encoded as WebP at 1200, 800 and 400 px wide.",
    "",
    "Regenerate with `node scripts/fetch-catalog-images.mjs`.",
    "",
    "| Product | Image | Photographer | Source |",
    "| --- | --- | --- | --- |",
  ];
  for (const product of products) {
    for (const [index, photo] of (manifest[product.slug] ?? []).entries()) {
      const slot = String(index + 1).padStart(2, "0");
      lines.push(
        `| ${product.name} | \`${product.slug}/${slot}\` | [${photo.photographer}](${photo.photographerUrl}) | [Pexels #${photo.id}](${photo.pageUrl}) |`,
      );
    }
  }
  writeFileSync(join(OUT_DIR, "CREDITS.md"), `${lines.join("\n")}\n`);
}

async function main() {
  const apiKey = readApiKey(ROOT);
  const allProducts = loadProducts();
  const products = ONLY.size ? allProducts.filter((product) => ONLY.has(product.slug)) : allProducts;
  if (ONLY.size && products.length !== ONLY.size) {
    throw new Error(`--only listed ${ONLY.size} slug(s) but matched ${products.length}`);
  }
  const manifest = loadManifest();
  // Pinned picks for products we are not touching stay reserved, so a re-pick cannot duplicate them.
  const taken = new Set(
    Object.entries(manifest)
      .filter(([slug]) => !ONLY.size || !ONLY.has(slug))
      .flatMap(([, photos]) => photos)
      .map((photo) => photo.id),
  );

  let searched = 0;
  for (const product of products) {
    if (manifest[product.slug]?.length >= MIN_IMAGES_PER_PRODUCT) continue;
    const picks = await resolveProduct(apiKey, product, taken);
    for (const photo of picks) taken.add(photo.id);
    manifest[product.slug] = picks;
    searched += 1;
    // Written every iteration: the free key allows 200 searches an hour, and a 429 halfway
    // through must not throw away the picks already made.
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`  resolved ${product.slug} -> ${picks.map((photo) => photo.id).join(", ")}`);
  }
  console.log(`manifest: ${Object.keys(manifest).length} products, ${searched} newly resolved`);

  writeCredits(allProducts, manifest);
  if (RESOLVE_ONLY) return;

  let bytes = 0;
  let downloaded = 0;
  for (const product of products) {
    for (const [index, photo] of manifest[product.slug].entries()) {
      const probe = join(OUT_DIR, product.slug, `${String(index + 1).padStart(2, "0")}-${WIDTHS[0]}.webp`);
      if (existsSync(probe) && !FORCE) {
        for (const width of WIDTHS) {
          const file = join(OUT_DIR, product.slug, `${String(index + 1).padStart(2, "0")}-${width}.webp`);
          if (existsSync(file)) bytes += statSync(file).size;
        }
        continue;
      }
      if (!photo.src) throw new Error(`Manifest entry ${product.slug}#${index} has no source URL; re-run with --refresh.`);
      bytes += await encode(await download(photo.src), product.slug, index);
      downloaded += 1;
    }
    process.stdout.write(`\r  encoded ${product.slug}${" ".repeat(20)}`);
  }
  console.log(`\ndownloaded ${downloaded} photo(s); ${(bytes / 1_048_576).toFixed(1)} MB across the slugs processed`);
}

await main();
