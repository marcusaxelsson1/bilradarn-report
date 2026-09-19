import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { fetchText, fetchSitemapEntries, parseUrlsetEntries, writeSourceFile, buildDealerEnvelope, mapConcurrent, filterCandidates, readIncrementalCache, writeIncrementalCache, planIncrementalFetch } from "../lib/adapter-base.mjs";
import { extractNextData, normalizeRegNumber } from "../lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "../lib/offer-schema.mjs";
import { matchesFamilyUrl, PRICE_MAX, MODEL_YEAR_MIN, MODEL_YEAR_MAX, MILEAGE_MAX_MIL } from "../lib/filters.mjs";

const ORIGIN = "https://hedinautomotive.se";
const SITEMAP_INDEX = `${ORIGIN}/sitemap.xml`;
const CAR_SITEMAPS = [`${ORIGIN}/car_0.xml`, `${ORIGIN}/car_1.xml`];
const LIST_URL = `${ORIGIN}/bilar/kop-bil/begagnade-bilar-i-lager`;
const SOURCE_KEY = "hedin";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_PATH = resolve(ROOT, "data", "import-cache", `${SOURCE_KEY}.json`);
const SOURCE_PATH = resolve(ROOT, "src", "data", "importers", `${SOURCE_KEY}.json`);

export function extractCar(html) {
  const data = extractNextData(html);
  const componentProps = data?.props?.pageProps?.componentProps ?? {};
  for (const guid of Object.keys(componentProps)) {
    const car = componentProps[guid]?.car;
    if (car && typeof car === "object" && (car.car_regno || car.car_price != null)) return car;
  }
  throw new Error("Hedins car-objekt saknas i __NEXT_DATA__");
}

export function discoverDetailUrls(sitemapXml) {
  return discoverDetailEntries(sitemapXml).map((entry) => entry.loc);
}

export function discoverDetailEntries(sitemapXml) {
  return [...new Map(
    parseUrlsetEntries(sitemapXml)
      .filter(({ loc }) => /\/bilar\/kop-bil\/\d+\//.test(loc))
      .filter(({ loc }) => matchesFamilyUrl(loc))
      .map((entry) => [entry.loc, entry]),
  ).values()];
}

export function yearFromSlug(url) {
  const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
  const match = slug.match(/(?:^|-)(20\d{2})(?:-|$)/);
  return match ? Number(match[1]) : null;
}

export function extractListPage(html) {
  const data = extractNextData(html);
  const components = data?.props?.pageProps?.componentProps ?? {};
  for (const component of Object.values(components)) {
    const query = component?.dehydratedState?.queries?.find((entry) => Array.isArray(entry?.state?.data?.pages));
    const page = query?.state?.data?.pages?.[0];
    if (page && Array.isArray(page.content) && Number.isFinite(Number(page.total_items))) return page;
  }
  throw new Error("Hedins serverrenderade sökresultat saknas i __NEXT_DATA__");
}

function buildListParams({
  pairs = [],
  years = [MODEL_YEAR_MIN, MODEL_YEAR_MAX],
  mileage = [0, MILEAGE_MAX_MIL],
  price = [0, PRICE_MAX],
} = {}) {
  const params = new URLSearchParams();
  for (const value of ["Begagnad", "Demo"]) params.append("car_condition", value);
  for (const value of years) params.append("car_year", String(value));
  for (const value of price) params.append("car_price", String(value));
  for (const value of mileage) params.append("car_mileage", String(value));
  for (const value of ["Bensin", "Diesel", "Hybrid"]) params.append("car_fuel", value);
  for (const value of ["Kombi", "SUV", "MPV", "Halvkombi"]) params.append("car_body", value);
  for (const brand of [...new Set(pairs.map(([name]) => name))]) params.append("car_brand", brand);
  for (const [brand, model] of pairs) params.append("car_model", `${brand}>${model}`);
  return params;
}

function urlsFromListPage(page) {
  return page.content
    .map((car) => car?.car_id && car?.slug ? `${ORIGIN}/bilar/kop-bil/${car.car_id}/${car.slug}` : null)
    .filter(Boolean);
}

function carIdFromUrl(url) {
  return new URL(url).pathname.match(/\/bilar\/kop-bil\/(\d+)\//)?.[1] ?? null;
}

export async function discoverFilteredListUrls() {
  let requests = 0;
  const getPage = async (params) => {
    requests += 1;
    return extractListPage(await fetchText(`${LIST_URL}?${params}`));
  };
  const basePage = await getPage(buildListParams());
  const tree = basePage.facet?.find((facet) => facet.name === "car_brand>car_model")?.value ?? [];
  const pairs = tree.flatMap((brand) => (brand.children ?? [])
    .filter((model) => matchesFamilyUrl(`/${brand.text}/${model.text}/`))
    .map((model) => [brand.text, model.text]));
  if (!pairs.length) throw new Error("Hedins publika modellfacetter gav inga familjemodeller");

  const urls = new Set();
  const collectPartition = async ({ pair, years, mileage = [0, MILEAGE_MAX_MIL], price = [0, PRICE_MAX] }) => {
    const page = await getPage(buildListParams({ pairs: [pair], years, mileage, price }));
    if (page.total_items <= 48) {
      urlsFromListPage(page).forEach((url) => urls.add(url));
      return;
    }
    const [mileageMin, mileageMax] = mileage;
    if (mileageMax - mileageMin > 500) {
      const middle = Math.floor((mileageMin + mileageMax) / 2);
      await collectPartition({ pair, years, mileage: [mileageMin, middle], price });
      await collectPartition({ pair, years, mileage: [middle + 1, mileageMax], price });
      return;
    }
    const [priceMin, priceMax] = price;
    if (priceMax - priceMin > 10000) {
      const middle = Math.floor((priceMin + priceMax) / 2);
      await collectPartition({ pair, years, mileage, price: [priceMin, middle] });
      await collectPartition({ pair, years, mileage, price: [middle + 1, priceMax] });
      return;
    }
    throw new Error(`Hedin-partitionen ${pair.join(" > ")} ${years.join("–")} har ${page.total_items} träffar även efter mil- och prisdelning`);
  };
  for (const brand of [...new Set(pairs.map(([name]) => name))]) {
    const brandPairs = pairs.filter(([name]) => name === brand);
    const brandPage = await getPage(buildListParams({ pairs: brandPairs }));
    if (brandPage.total_items <= 48) {
      urlsFromListPage(brandPage).forEach((url) => urls.add(url));
      continue;
    }
    for (const pair of brandPairs) {
      const modelPage = await getPage(buildListParams({ pairs: [pair] }));
      if (modelPage.total_items <= 48) {
        urlsFromListPage(modelPage).forEach((url) => urls.add(url));
        continue;
      }
      for (let year = MODEL_YEAR_MIN; year <= MODEL_YEAR_MAX; year += 1) {
        await collectPartition({ pair, years: [year, year] });
      }
    }
  }
  return { urls: [...urls], requests, models: pairs.length };
}

export function normalizeDetail(url, html, checkedAt = new Date().toISOString()) {
  const car = extractCar(html);
  const equipment = Array.isArray(car.car_equipment) ? car.car_equipment : [];
  const images = (Array.isArray(car.car_images) ? car.car_images : []).map((image) => image.original ?? image.thumbnail_url).filter(Boolean);
  const reg = normalizeRegNumber(car.car_regno);
  const mileageMil = car.car_mileage != null ? Number(car.car_mileage) : car.car_odometer != null ? Math.round(Number(car.car_odometer) / 10) : null;
  const title = car.car_model_text ?? [car.car_brand, car.car_model].filter(Boolean).join(" ");

  return buildPurchaseOffer({
    id: `hedin:${car.car_id ?? reg ?? url}`,
    title,
    variant: car.car_version ?? null,
    registrationNumber: reg,
    vin: car.car_chassino ?? null,
    priceSek: car.car_price ?? null,
    modelYear: car.car_year ?? null,
    mileageMil,
    fuelType: car.car_fuel ?? null,
    transmission: car.car_gearbox ?? null,
    bodyType: car.car_body ?? null,
    color: car.car_color ?? null,
    consumptionL100Km: car.car_fuel_combined_text ? Number(String(car.car_fuel_combined_text).replace(",", ".")) : null,
    dealer: car.car_sellers?.[0]?.name ?? "Hedin Automotive",
    place: car.car_site_city ?? null,
    sourceUrl: url,
    sourceOwner: "Hedin Automotive",
    sourceCheckedAt: checkedAt,
    availability: car.car_is_used || car.car_condition === "Begagnad" ? "available" : "unknown",
    equipment,
    marketedText: [title, car.car_version, ...equipment].filter(Boolean).join(" "),
    imageUrls: images,
    lifecycle: "preliminary",
  });
}

export async function importHedin({ detailLimit = Infinity } = {}) {
  const checkedAt = new Date().toISOString();
  const errors = [];
  const cache = await readIncrementalCache(CACHE_PATH);
  const cachedEntries = cache.entries ?? {};
  const sitemapStates = cache.sitemaps ?? {};
  const sitemapEntries = [];
  let unchangedSitemaps = 0;
  for (const sitemapUrl of CAR_SITEMAPS) {
    try {
      const loaded = await fetchSitemapEntries(sitemapUrl, sitemapStates[sitemapUrl] ?? {});
      sitemapStates[sitemapUrl] = loaded.state;
      sitemapEntries.push(...loaded.entries);
      if (loaded.notModified) unchangedSitemaps += 1;
    } catch (error) {
      errors.push({ url: sitemapUrl, message: error.message });
      if (Array.isArray(sitemapStates[sitemapUrl]?.entries)) sitemapEntries.push(...sitemapStates[sitemapUrl].entries);
    }
  }
  if (!sitemapEntries.length) {
    throw new Error(`Hedin-hämtningen avbröts utan sitemapdata: ${errors.at(-1)?.message ?? "okänt fel"}`);
  }

  const familyEntries = [...new Map(
    sitemapEntries
      .filter(({ loc }) => /\/bilar\/kop-bil\/\d+\//.test(loc))
      .filter(({ loc }) => matchesFamilyUrl(loc))
      .map((entry) => [entry.loc, entry]),
  ).values()];
  const entryByUrl = new Map(familyEntries.map((entry) => [entry.loc, entry]));
  const entryByCarId = new Map(familyEntries.map((entry) => [carIdFromUrl(entry.loc), entry]));
  const slugEligibleEntries = familyEntries.filter(({ loc }) => {
    const year = yearFromSlug(loc);
    return year == null || (year >= MODEL_YEAR_MIN && year <= MODEL_YEAR_MAX);
  });
  const slugEligibleUrls = new Set(slugEligibleEntries.map(({ loc }) => loc));

  let listDiscovery = { urls: [], requests: 0, models: 0 };
  try {
    listDiscovery = await discoverFilteredListUrls();
  } catch (error) {
    errors.push({ url: LIST_URL, stage: "public-filter", message: error.message });
  }
  const filteredCanonicalUrls = listDiscovery.urls
    .map((url) => entryByCarId.get(carIdFromUrl(url))?.loc)
    .filter((url) => url && slugEligibleUrls.has(url));

  if (!cache.initialized) {
    let previous = null;
    try { previous = JSON.parse(await readFile(SOURCE_PATH, "utf8")); } catch { /* första körningen */ }
    for (const offer of previous?.offers ?? []) {
      if (!offer.sourceUrl || !entryByUrl.has(offer.sourceUrl)) continue;
      cachedEntries[offer.sourceUrl] = {
        lastmod: entryByUrl.get(offer.sourceUrl)?.lastmod ?? null,
        lastFetchedAt: offer.sourceCheckedAt ?? checkedAt,
        offer,
        lastError: null,
      };
    }
    const initialUrls = new Set([
      ...filteredCanonicalUrls,
      ...slugEligibleEntries.filter(({ loc }) => yearFromSlug(loc) == null).map(({ loc }) => loc),
      ...Object.keys(cachedEntries),
    ]);
    if (!listDiscovery.urls.length) slugEligibleEntries.forEach(({ loc }) => initialUrls.add(loc));
    for (const entry of slugEligibleEntries) {
      if (!cachedEntries[entry.loc] && !initialUrls.has(entry.loc)) {
        cachedEntries[entry.loc] = { lastmod: entry.lastmod, skippedAt: checkedAt, offer: null, lastError: null };
      }
    }
  }

  const plan = planIncrementalFetch(slugEligibleEntries, cachedEntries, { now: new Date(checkedAt) });
  const selectedUrls = new Set(plan.selected);
  for (const url of filteredCanonicalUrls) {
    const cached = cachedEntries[url];
    if (!cached?.offer || (Date.parse(checkedAt) - Date.parse(cached.lastFetchedAt ?? 0)) >= 12 * 60 * 60 * 1000) selectedUrls.add(url);
  }
  const urls = [...selectedUrls].filter((url) => entryByUrl.has(url)).slice(0, detailLimit);

  await mapConcurrent(urls, 6, async (url) => {
    try {
      const offer = normalizeDetail(url, await fetchText(url), checkedAt);
      cachedEntries[url] = { lastmod: entryByUrl.get(url)?.lastmod ?? null, lastFetchedAt: checkedAt, offer, lastError: null };
    } catch (error) {
      errors.push({ url, message: error.message });
      const previous = cachedEntries[url] ?? {};
      cachedEntries[url] = { ...previous, lastmod: entryByUrl.get(url)?.lastmod ?? previous.lastmod ?? null, lastFetchedAt: checkedAt, lastError: error.message };
    }
  });

  const currentUrls = new Set(familyEntries.map((entry) => entry.loc));
  for (const url of Object.keys(cachedEntries)) if (!currentUrls.has(url)) delete cachedEntries[url];
  const normalized = slugEligibleEntries.map(({ loc }) => cachedEntries[loc]?.offer).filter(Boolean);
  const { included: offers, funnel } = filterCandidates(normalized, {
    discovered: familyEntries.length,
    prefiltered: slugEligibleEntries.length,
    publicFilterCandidates: filteredCanonicalUrls.length,
    publicFilterRequests: listDiscovery.requests,
    publicFilterModels: listDiscovery.models,
    detailPagesRequested: urls.length,
    reusedCachedDetails: Math.max(0, normalized.length - urls.length),
    incrementalReasons: Object.values(plan.reasons).reduce((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {}),
  });
  await writeIncrementalCache(CACHE_PATH, { schemaVersion: 1, initialized: true, updatedAt: checkedAt, sitemaps: sitemapStates, entries: cachedEntries });
  const result = buildDealerEnvelope({ key: SOURCE_KEY, name: "Hedin Automotive", role: "Handlaradapter för Hedins publika begagnadlager (sitemap + publika SSR-filter, aldrig /data/)", checkedAt, offers, errors, extraSource: { sitemap: SITEMAP_INDEX, vehicleSitemaps: CAR_SITEMAPS, unchangedSitemaps, detailPagesRead: urls.length, funnel } });
  await writeSourceFile(SOURCE_KEY, result);
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importHedin();
  console.log(`Hedin: ${result.offers.length} familjemodeller, ${result.errors.length} fel.`);
}
