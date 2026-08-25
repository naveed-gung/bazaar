/**
 * Minimal Pexels client for the catalogue image pipeline.
 *
 * The key is read from `.env.local` (gitignored) or the environment — never checked in.
 * Pexels licence: free to use, modification allowed, attribution not required. We still write
 * `frontend/public/catalog/CREDITS.md` so every photographer is named.
 *
 * Docs: https://www.pexels.com/api/documentation/
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.pexels.com/v1";

/** Reads PEXELS_API_KEY from the environment, falling back to `.env.local` at the repo root. */
export function readApiKey(repoRoot) {
  if (process.env["PEXELS_API_KEY"]) return process.env["PEXELS_API_KEY"];
  let text = "";
  try {
    text = readFileSync(join(repoRoot, ".env.local"), "utf8");
  } catch {
    throw new Error("PEXELS_API_KEY is not set and .env.local could not be read.");
  }
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith("PEXELS_API_KEY="));
  if (!line) throw new Error("PEXELS_API_KEY is missing from .env.local.");
  const value = line.slice("PEXELS_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  if (!value) throw new Error("PEXELS_API_KEY in .env.local is empty.");
  return value;
}

/**
 * One search page. Returns the raw photo objects so callers can pick and record ids.
 * Rate limit is 200 requests/hour on a free key, so callers should cache aggressively.
 */
export async function searchPhotos(apiKey, query, { perPage = 20, page = 1, orientation } = {}) {
  const params = new URLSearchParams({ query, per_page: String(perPage), page: String(page) });
  if (orientation) params.set("orientation", orientation);
  const response = await fetch(`${API}/search?${params}`, { headers: { Authorization: apiKey } });
  if (response.status === 429) throw new Error("Pexels rate limit reached (200/hour on a free key).");
  if (!response.ok) throw new Error(`Pexels search failed: ${response.status} ${response.statusText}`);
  const body = await response.json();
  return Array.isArray(body.photos) ? body.photos : [];
}

/** Fetch a single photo by id, used to re-resolve a pinned manifest entry. */
export async function getPhoto(apiKey, id) {
  const response = await fetch(`${API}/photos/${id}`, { headers: { Authorization: apiKey } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Pexels photo ${id} failed: ${response.status} ${response.statusText}`);
  return response.json();
}

/**
 * Product photography filter. Rejects anything the 1200x1500 crop would have to upscale,
 * anything wildly off a portrait-ish product aspect, and anything the search returned
 * without a usable original file.
 */
export function usable(photo) {
  if (!photo?.src?.original) return false;
  if (photo.width < 1200 || photo.height < 1500) return false;
  const aspect = photo.width / photo.height;
  return aspect >= 0.6 && aspect <= 1.9;
}

/** Highest-resolution download URL Pexels exposes for a photo. */
export function downloadUrl(photo) {
  return photo.src?.original ?? photo.src?.large2x ?? photo.src?.large;
}

/**
 * The manifest entry: enough to credit the photographer, re-download the file without another
 * search call, and write sensible alt text.
 */
export function toCredit(photo) {
  return {
    id: photo.id,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url,
    pageUrl: photo.url,
    src: downloadUrl(photo),
    alt: (photo.alt || "").trim(),
  };
}
