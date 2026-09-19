import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PRICE_MIN, PRICE_MAX, MODEL_YEAR_MIN, MODEL_YEAR_MAX, MILEAGE_MAX_MIL } from "./lib/filters.mjs";
import { numberFromText, extractDefinitionPairs, extractCarJsonLd, findPair } from "./lib/normalize-adapter.mjs";
import { buildPurchaseOffer } from "./lib/offer-schema.mjs";
import { filterCandidates } from "./lib/adapter-base.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "src/data/importers/wayke.json");
const HISTORY = resolve(ROOT, "data/import-history.json");
const WAYKE_ORIGIN = "https://www.wayke.se";

export const SEARCH_FILTERS = {
  latitude: 57.7089,
  longitude: 11.9746,
  radiusKm: 150,
  priceMin: PRICE_MIN,
  priceMax: PRICE_MAX,
  modelYearMin: MODEL_YEAR_MIN,
  modelYearMax: MODEL_YEAR_MAX,
  mileageMaxMil: MILEAGE_MAX_MIL,
};

export function parseReactQueryPayload(html) {
  const matches = [...html.matchAll(/window\["__RQ_R_lb_"\]\.push\((\{.*?\})\);<\/script>/gs)];
  if (!matches.length) throw new Error("Waykes strukturerade sökdata saknas i HTML-svaret");
  return matches.map((match) => JSON.parse(match[1]));
}

function normalizeSearchAdHit(hit) {
  const ad = hit?.ad ?? {};
  const iteration = hit?.iteration ?? {};
  const item = iteration.item ?? {};
  const odometer = iteration.logistics?.odometerReading;
  const cashPrice = ad.pricing?.cash?.price?.amount;
  return {
    _id: ad.id ?? iteration.id,
    title: item.displayName ?? ad.salesDescription?.title ?? "",
    shortDescription: ad.salesDescription?.title ?? "",
    modelYear: item.modelYear?.intValue ?? null,
    price: cashPrice == null ? null : Number(cashPrice),
    mileage: odometer?.value == null ? null : Number(odometer.value),
    fuelType: item.driveline?.fuelTypesString?.stringValue ?? null,
    gearboxType: item.attributes?.transmission?.formattedValue ?? null,
    branches: ad.branch ? [{ name: ad.branch.displayName }] : [],
    position: ad.branch?.city ? { city: ad.branch.city } : null,
  };
}

export function extractSearchDocuments(html) {
  const payloads = parseReactQueryPayload(html);
  const queries = payloads.flatMap((payload) => payload.queries ?? []);
  const legacyQuery = queries.find((entry) => entry.queryKey?.[0] === "vehicles");
  if (legacyQuery?.state?.data?.documentList) {
    return {
      totalHits: legacyQuery.state.data.documentList.numberOfHits ?? 0,
      queryKey: legacyQuery.queryKey,
      documents: legacyQuery.state.data.documentList.documents ?? [],
    };
  }

  const searchAdsQuery = queries.find((entry) => entry.queryKey?.[0] === "search-ads");
  const searchAds = searchAdsQuery?.state?.data;
  if (Array.isArray(searchAds?.hits)) {
    return {
      totalHits: searchAds.found ?? searchAds.hits.length,
      queryKey: searchAdsQuery.queryKey,
      documents: searchAds.hits.map(normalizeSearchAdHit).filter((document) => document._id),
    };
  }
  throw new Error("Waykes fordonslista saknas i söksvaret");
}

function samplePriority(document) {
  const agePenalty = Math.max(0, SEARCH_FILTERS.modelYearMax - Number(document.modelYear || 0)) * 5000;
  const text = `${document.title ?? ""} ${document.shortDescription ?? ""}`.toLowerCase();
  const equipmentBonus = /kamera|camera/.test(text) ? 60000 : 0;
  return Number(document.price || 9999999) + Number(document.mileage || 99999) * 2 + agePenalty - equipmentBonus;
}

function collectImageUrls(html, car) {
  const urls = new Set(Array.isArray(car.image) ? car.image : car.image ? [car.image] : []);
  for (const match of html.matchAll(/https:\/\/cdn\.wayke\.se\/media\/[a-f0-9-]+\/[a-f0-9-]+/gi)) urls.add(match[0]);
  for (const match of html.matchAll(/https:\/\/cdn\.wayke\.se\/cfit\/v3\/[a-f0-9-]+\/[a-f0-9-]+/gi)) {
    urls.add(`${match[0]}?format=jpeg&w=1170`);
  }
  return [...urls].slice(0, 40);
}

export function normalizeDetail(document, html, checkedAt = new Date().toISOString()) {
  const car = extractCarJsonLd(html);
  const pairs = extractDefinitionPairs(html);
  const yesEquipment = [...new Set(pairs.filter(({ value }) => /^ja$/i.test(value)).map(({ label }) => label))];
  const marketedText = `${document.shortDescription ?? ""} ${car.vehicleConfiguration ?? ""}`;
  const annualTax = numberFromText(findPair(pairs, /årlig fordonsskatt/i));
  const malusTax = numberFromText(findPair(pairs, /malus/i));
  const sourceUrl = car.url || `${WAYKE_ORIGIN}/objekt/${document._id}`;

  return buildPurchaseOffer({
    id: `wayke:${document._id}`,
    title: car.name || document.title,
    variant: document.shortDescription || car.vehicleConfiguration || "Variant ej angiven",
    registrationNumber: car.identifier?.value ?? null,
    vin: car.vehicleIdentificationNumber ?? null,
    priceSek: Number(car.offers?.price ?? document.price),
    modelYear: Number(car.vehicleModelDate ?? document.modelYear),
    mileageMil: Number(document.mileage),
    fuelType: document.fuelType,
    transmission: car.vehicleTransmission || document.gearboxType,
    bodyType: car.bodyType ?? null,
    color: car.color ?? null,
    consumptionL100Km: numberFromText(car.fuelConsumption?.value),
    annualTaxSek: annualTax,
    malusTaxSek: malusTax,
    dealer: car.offers?.seller?.name || document.branches?.[0]?.name || "Okänd handlare",
    dealerUrl: car.offers?.seller?.url ?? null,
    place: document.position?.city ?? null,
    distanceKm: Math.round(Number(document.distance ?? 0)),
    sourceUrl,
    sourceOwner: "Wayke / angiven bilhandlare",
    sourceCheckedAt: checkedAt,
    publishedAt: document.itemPublished ?? car.offers?.validFrom ?? null,
    availability: car.offers?.availability?.endsWith("InStock") ? "available" : "unknown",
    equipment: yesEquipment,
    marketedText,
    imageUrls: collectImageUrls(html, car),
    lifecycle: "observed",
    passesListingFilters: true,
  });
}

export function buildSearchUrl(offset = 0) {
  const params = new URLSearchParams({
    lat: String(SEARCH_FILTERS.latitude),
    lon: String(SEARCH_FILTERS.longitude),
    "position.location": String(SEARCH_FILTERS.radiusKm),
    "position.name": "Göteborg",
    "price.min": String(SEARCH_FILTERS.priceMin),
    "price.max": String(SEARCH_FILTERS.priceMax),
    "modelYear.min": String(SEARCH_FILTERS.modelYearMin),
    "modelYear.max": String(SEARCH_FILTERS.modelYearMax),
    "mileage.max": String(SEARCH_FILTERS.mileageMaxMil),
    offset: String(offset),
    sort: "itemSortDesc",
  });
  for (const fuel of ["Bensin", "Diesel", "Elhybrid"]) params.append("fuelType", fuel);
  for (const chassis of ["Kombi", "SUV", "Halvkombi"]) params.append("chassis", chassis);
  return `${WAYKE_ORIGIN}/sok?${params}`;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Bilradarn/0.1 private research; source verification" },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`${response.status} från ${url}`);
  return response.text();
}

async function loadPrevious() {
  try { return JSON.parse(await readFile(OUTPUT, "utf8")); } catch { return { offers: [] }; }
}

function detectChanges(previous, nextOffers) {
  const before = new Map((previous.offers ?? []).map((offer) => [offer.id, offer]));
  const after = new Map(nextOffers.map((offer) => [offer.id, offer]));
  const changes = [];
  for (const offer of nextOffers) {
    const old = before.get(offer.id);
    if (!old) changes.push({ type: "new", id: offer.id, title: offer.title, at: offer.sourceCheckedAt });
    else if (old.priceSek !== offer.priceSek) changes.push({ type: "price", id: offer.id, title: offer.title, before: old.priceSek, after: offer.priceSek, at: offer.sourceCheckedAt });
  }
  for (const offer of before.values()) if (!after.has(offer.id)) changes.push({ type: "not-in-current-sample", id: offer.id, title: offer.title, at: new Date().toISOString() });
  return changes;
}

export async function importWayke({ pages = 8, detailLimit = 40 } = {}) {
  const checkedAt = new Date().toISOString();
  const previous = await loadPrevious();
  const searchDocuments = [];
  const errors = [];
  let totalHits = 0;
  for (let page = 0; page < pages; page += 1) {
    const url = buildSearchUrl(page * 24);
    try {
      const html = await fetchText(url);
      const result = extractSearchDocuments(html);
      totalHits = result.totalHits;
      searchDocuments.push(...result.documents);
      if (result.documents.length < 24) break;
    } catch (error) {
      errors.push({ url, stage: "search", message: error.message });
      break;
    }
  }

  if (!searchDocuments.length && errors.length) {
    const staleOffers = previous.offers ?? [];
    const result = {
      ...previous,
      schemaVersion: 1,
      generatedAt: checkedAt,
      mode: "degraded",
      source: {
        ...(previous.source ?? {}),
        name: "Wayke",
        role: "Upptäckts- och detaljkälla för svenska bilhandlarannonser",
        searchUrl: buildSearchUrl(0),
        status: "stale-fallback",
        lastSuccessfulAt: previous.generatedAt ?? null,
      },
      offers: staleOffers,
      changes: [],
      errors,
    };
    await persistResult(result, checkedAt);
    return result;
  }

  const discovered = [...new Map(searchDocuments.map((document) => [document._id, document])).values()];
  const listCandidates = discovered.map((document) => ({
    document,
    title: document.title,
    variant: document.shortDescription,
    priceSek: document.price,
    modelYear: document.modelYear,
    mileageMil: document.mileage,
    fuelType: document.fuelType,
    transmission: document.gearboxType,
  }));
  const prefilter = filterCandidates(listCandidates, { discovered: discovered.length });
  const candidates = prefilter.included.map(({ document }) => document)
    .sort((a, b) => samplePriority(a) - samplePriority(b))
    .slice(0, detailLimit);

  const normalized = [];
  for (const document of candidates) {
    const url = `${WAYKE_ORIGIN}/objekt/${document._id}`;
    try {
      normalized.push(normalizeDetail(document, await fetchText(url), checkedAt));
    } catch (error) {
      errors.push({ id: document._id, url, message: error.message });
    }
  }

  const final = filterCandidates(normalized, {
    discovered: discovered.length,
    prefiltered: candidates.length,
    detailPagesRequested: candidates.length,
    prefilterRejected: prefilter.funnel.rejected,
    prefilterRejectionReasons: prefilter.funnel.rejectionReasons,
  });
  const offers = final.included;

  const result = {
    schemaVersion: 1,
    generatedAt: checkedAt,
    mode: "live",
    source: {
      name: "Wayke",
      role: "Upptäckts- och detaljkälla för svenska bilhandlarannonser",
      searchUrl: buildSearchUrl(0),
      searchPagesRead: pages,
      reportedHits: totalHits,
      documentsRead: searchDocuments.length,
      detailPagesRead: offers.length,
      status: errors.some((error) => error.stage === "search") ? "partial" : "ok",
      funnel: final.funnel,
    },
    filters: SEARCH_FILTERS,
    offers,
    changes: detectChanges(previous, offers),
    errors,
  };

  await persistResult(result, checkedAt);
  return result;
}

async function persistResult(result, checkedAt) {
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await mkdir(dirname(HISTORY), { recursive: true });
  let history = [];
  try { history = JSON.parse(await readFile(HISTORY, "utf8")); } catch { /* first run */ }
  history.push({ generatedAt: checkedAt, mode: result.mode, offers: result.offers?.length ?? 0, changes: result.changes ?? [], errors: result.errors ?? [] });
  await writeFile(HISTORY, `${JSON.stringify(history.slice(-60), null, 2)}\n`, "utf8");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await importWayke();
  console.log(`Importerade ${result.offers.length} riktiga annonser från ${result.source.documentsRead} sökträffar.`);
  console.log(`${result.offers.filter((offer) => offer.quality.passesRequiredEquipment).length} annonser är rankningsbara efter grundfiltren; utrustning med okänd status märks separat.`);
  console.log(`${result.changes.length} förändringar, ${result.errors.length} detaljfel.`);
}
