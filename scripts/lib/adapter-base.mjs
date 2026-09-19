import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRICE_MIN, PRICE_MAX, MODEL_YEAR_MIN, MODEL_YEAR_MAX, MILEAGE_MAX_MIL } from "./filters.mjs";
import { evaluateCandidate, summarizeDecisions } from "./filters.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const IMPORTERS_DIR = resolve(ROOT, "src/data/importers");
const USER_AGENT = "Bilradarn/0.1 private research; source verification";

export const FAMILY_FILTERS = { priceMin: PRICE_MIN, priceMax: PRICE_MAX, modelYearMin: MODEL_YEAR_MIN, modelYearMax: MODEL_YEAR_MAX, mileageMaxMil: MILEAGE_MAX_MIL };

export class HttpError extends Error {
  constructor(status, url) {
    super(`${status} från ${url}`);
    this.name = "HttpError";
    this.status = status;
    this.url = url;
  }
}

export async function fetchText(url, { userAgent = USER_AGENT, timeoutMs = 25000 } = {}) {
  const response = await fetch(url, { headers: { "user-agent": userAgent }, signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new HttpError(response.status, url);
  return response.text();
}

export async function fetchConditionalText(url, { etag = null, lastModified = null, userAgent = USER_AGENT, timeoutMs = 25000 } = {}) {
  const headers = { "user-agent": userAgent };
  if (etag) headers["if-none-match"] = etag;
  if (lastModified) headers["if-modified-since"] = lastModified;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
  if (response.status === 304) {
    return { notModified: true, text: null, etag, lastModified };
  }
  if (!response.ok) throw new HttpError(response.status, url);
  return {
    notModified: false,
    text: await response.text(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

export function parseUrlsetUrls(xml) {
  return parseUrlsetEntries(xml).map((entry) => entry.loc);
}

export function parseUrlsetEntries(xml) {
  const entries = [];
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const block = match[1];
    const loc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1]?.trim().replaceAll("&amp;", "&");
    const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1]?.trim() ?? null;
    if (loc) entries.push({ loc, lastmod });
  }
  return entries;
}

export function parseSitemapIndex(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<]+?)\s*<\/loc>[\s\S]*?<\/sitemap>/g)) {
    const loc = match[1].trim();
    if (loc) urls.push(loc);
  }
  return urls;
}

export async function readIncrementalCache(cachePath) {
  try { return JSON.parse(await readFile(cachePath, "utf8")); } catch { return {}; }
}

export async function writeIncrementalCache(cachePath, value) {
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function fetchSitemapEntries(url, previous = {}) {
  const response = await fetchConditionalText(url, previous);
  if (response.notModified) {
    if (!Array.isArray(previous.entries)) throw new Error(`304 från ${url} utan sparade sitemap-poster`);
    return { entries: previous.entries, state: { ...previous, checkedAt: new Date().toISOString() }, notModified: true };
  }
  const entries = parseUrlsetEntries(response.text);
  return {
    entries,
    state: {
      etag: response.etag,
      lastModified: response.lastModified,
      checkedAt: new Date().toISOString(),
      entries,
    },
    notModified: false,
  };
}

function stableBucket(value, modulo) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % modulo;
}

export function planIncrementalFetch(sitemapEntries, cachedEntries = {}, {
  now = new Date(),
  priorityRefreshMs = 12 * 60 * 60 * 1000,
  sampleRefreshMs = 6 * 24 * 60 * 60 * 1000,
  sampleModulo = 50,
} = {}) {
  const week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const selected = [];
  const reasons = {};
  for (const { loc, lastmod } of sitemapEntries) {
    const cached = cachedEntries[loc];
    const age = cached?.lastFetchedAt ? now.getTime() - Date.parse(cached.lastFetchedAt) : Infinity;
    let reason = null;
    if (!cached) reason = "new";
    else if ((cached.lastmod ?? null) !== (lastmod ?? null)) reason = "changed";
    else if (cached.offer?.quality?.selection?.included && age >= priorityRefreshMs) reason = "priority-refresh";
    else if (age >= sampleRefreshMs && stableBucket(`${loc}:${week}`, sampleModulo) === 0) reason = "sample";
    else if (!cached.offer && cached.lastError && age >= priorityRefreshMs) reason = "retry";
    if (reason) {
      selected.push(loc);
      reasons[loc] = reason;
    }
  }
  return { selected, reasons };
}

export async function writeSourceFile(sourceKey, result) {
  const output = resolve(IMPORTERS_DIR, `${sourceKey}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  return output;
}

export function buildDealerEnvelope({ key, name, role, checkedAt, offers, errors = [], extraSource = {} }) {
  return {
    schemaVersion: 1,
    generatedAt: checkedAt,
    mode: "live",
    source: { key, name, role, detailPagesRead: offers.length, ...extraSource },
    filters: FAMILY_FILTERS,
    offers,
    changes: [],
    errors,
  };
}

export function filterCandidates(candidates = [], extra = {}) {
  const evaluated = candidates.map((candidate) => ({ candidate, decision: candidate?.quality?.selection ?? evaluateCandidate(candidate) }));
  return {
    included: evaluated.filter(({ decision }) => decision.included).map(({ candidate }) => candidate),
    funnel: summarizeDecisions(evaluated.map(({ decision }) => decision), extra),
  };
}
