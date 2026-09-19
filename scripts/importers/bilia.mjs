import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, fetchSitemapEntries, parseUrlsetEntries, writeSourceFile, buildDealerEnvelope, mapConcurrent, filterCandidates, readIncrementalCache, writeIncrementalCache, planIncrementalFetch } from "../lib/adapter-base.mjs";
import { extractCarJsonLd, extractJsonLdByType, extractListItemTexts, decodeHtml, normalizeRegNumber } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";
import { matchesFamilyUrl } from "../lib/filters.mjs";

const ORIGIN = "https://www.bilia.se";
const SITEMAP_INDEX = `${ORIGIN}/sitemap_index.xml`;
const CARS_SITEMAP = `${ORIGIN}/cars-sitemap.xml`;
const SOURCE_KEY = "bilia";
const CACHE_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "data", "import-cache", `${SOURCE_KEY}.json`);

export function regNumberFromSlug(url) {
  try {
    const clean = new URL(url).pathname.replace(/\/+$/, "");
    const segment = clean.split("/").filter(Boolean).pop();
    return segment ? normalizeRegNumber(segment) : null;
  } catch {
    return null;
  }
}

export function discoverDetailUrls(sitemapXml) {
  return discoverDetailEntries(sitemapXml).map((entry) => entry.loc);
}

export function discoverDetailEntries(sitemapXml) {
  return [...new Map(
    parseUrlsetEntries(sitemapXml)
      .filter(({ loc }) => /\/bilar\/sok-bil\/[^/]+\/[^/]+\/[^/]+\/?$/.test(loc))
      .filter(({ loc }) => matchesFamilyUrl(loc))
      .map((entry) => [entry.loc, entry]),
  ).values()];
}

export function normalizeDetail(url, html, checkedAt = new Date().toISOString()) {
  const car = extractCarJsonLd(html);
  const webPage = extractJsonLdByType(html, "WebPage");
  const description = webPage?.description ?? car.description ?? "";
  const equipment = extractListItemTexts(description);
  const reg = regNumberFromSlug(url);
  const mileageKm = car.mileageFromOdometer?.value;
  const marketedText = `${car.name ?? ""} ${decodeHtml(description)}`;

  return buildPurchaseOffer({
    id: `bilia:${reg ?? car.vehicleIdentificationNumber ?? url}`,
    title: car.name ?? car.model ?? "Bilia bil",
    variant: [car.brand?.name, car.model].filter(Boolean).join(" "),
    registrationNumber: reg,
    vin: car.vehicleIdentificationNumber ?? null,
    priceSek: car.offers?.price ?? null,
    modelYear: car.vehicleModelDate ?? car.modelDate ?? null,
    mileageMil: mileageKm != null ? Math.round(Number(mileageKm) / 10) : null,
    fuelType: car.vehicleEngine?.fuelType ?? null,
    transmission: car.vehicleTransmission ?? null,
    bodyType: car.bodyType ?? null,
    color: car.color ?? null,
    dealer: car.offers?.seller?.name ?? car.offers?.seller?.["@id"] ?? "Bilia",
    sourceUrl: url,
    sourceOwner: "Bilia",
    sourceCheckedAt: checkedAt,
    availability: car.offers?.availability?.endsWith("InStock") ? "available" : "unknown",
    equipment,
    marketedText,
    imageUrls: Array.isArray(car.image) ? car.image : car.image ? [car.image] : [],
    lifecycle: "preliminary",
  });
}

export async function importBilia({ detailLimit = Infinity } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  let unavailableListings = 0;
  const cache = await readIncrementalCache(CACHE_PATH);
  let sitemapEntries = [];
  let sitemapState = cache.sitemap ?? {};
  let sitemapNotModified = false;
  try {
    const loaded = await fetchSitemapEntries(CARS_SITEMAP, sitemapState);
    sitemapEntries = loaded.entries;
    sitemapState = loaded.state;
    sitemapNotModified = loaded.notModified;
  } catch (error) {
    errors.push({ url: CARS_SITEMAP, message: error.message });
    sitemapEntries = Array.isArray(sitemapState.entries) ? sitemapState.entries : [];
  }
  if (!sitemapEntries.length) {
    throw new Error(`Bilia-hämtningen avbröts utan sitemapdata: ${errors.at(-1)?.message ?? "okänt fel"}`);
  }

  const relevantEntries = sitemapEntries
    .filter(({ loc }) => /\/bilar\/sok-bil\/[^/]+\/[^/]+\/[^/]+\/?$/.test(loc))
    .filter(({ loc }) => matchesFamilyUrl(loc));
  const entryByUrl = new Map(relevantEntries.map((entry) => [entry.loc, entry]));
  const cachedEntries = cache.entries ?? {};
  const plan = planIncrementalFetch(relevantEntries, cachedEntries, { now: new Date(checkedAt) });
  const urls = plan.selected.slice(0, detailLimit);

  await mapConcurrent(urls, 6, async (url) => {
    try {
      const offer = normalizeDetail(url, await fetchText(url), checkedAt);
      cachedEntries[url] = { lastmod: entryByUrl.get(url)?.lastmod ?? null, lastFetchedAt: checkedAt, offer, lastError: null };
    } catch (error) {
      const previous = cachedEntries[url] ?? {};
      if (error?.status === 404 || error?.status === 410) {
        unavailableListings += 1;
        cachedEntries[url] = { lastmod: entryByUrl.get(url)?.lastmod ?? null, lastFetchedAt: checkedAt, offer: null, unavailable: true, lastError: error.message };
      } else {
        errors.push({ url, message: error.message });
        cachedEntries[url] = { ...previous, lastmod: entryByUrl.get(url)?.lastmod ?? previous.lastmod ?? null, lastFetchedAt: checkedAt, lastError: error.message };
      }
    }
  });

  const currentUrls = new Set(relevantEntries.map((entry) => entry.loc));
  for (const url of Object.keys(cachedEntries)) if (!currentUrls.has(url)) delete cachedEntries[url];
  const normalized = relevantEntries.map(({ loc }) => cachedEntries[loc]?.offer).filter(Boolean);

  const { included: offers, funnel } = filterCandidates(normalized, {
    discovered: relevantEntries.length,
    prefiltered: urls.length,
    detailPagesRequested: urls.length,
    reusedCachedDetails: Math.max(0, normalized.length - urls.length),
    incrementalReasons: Object.values(plan.reasons).reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {}),
    unavailableListings,
  });
  await writeIncrementalCache(CACHE_PATH, { schemaVersion: 1, updatedAt: checkedAt, sitemap: sitemapState, entries: cachedEntries });
  const result = buildDealerEnvelope({
    key: SOURCE_KEY,
    name: "Bilia",
    role: "Handlaradapter för Bilias publika begagnadlager",
    checkedAt,
    offers,
    errors,
    extraSource: { sitemap: SITEMAP_INDEX, vehicleSitemap: CARS_SITEMAP, sitemapNotModified, detailPagesRead: urls.length, unavailableListings, funnel },
  });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importBilia();
  console.log(`Bilia: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}
